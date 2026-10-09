import i18n from "@/i18n";
import { create } from "zustand";
import { authGeneration, getAuthToken } from "@/lib/authToken";
import {
  apiClearRecipes,
  apiClearShopping,
  apiGetState,
  apiImportJson,
  apiPutState,
} from "@/api/client";
import {
  markLegacyPromptImportDone,
  mergeLegacyLocalStoragePrompts,
} from "@/lib/legacyLocalPromptSettings";
import { mergeServerWithLocalDraft } from "@/lib/mergeOfflineState";
import { normalizeAppState } from "@/lib/normalizeAppState";
import { loadAppCache, saveAppCache } from "@/lib/offlineDb";
import { getTenantCacheKey, tenantCacheKeyFromToken } from "@/lib/tenantCacheKey";
import type { AppState } from "@/types";

type AppStore = {
  state: AppState | null;
  error: string | null;
  loading: boolean;
  pendingSync: boolean;
  setError: (e: string | null) => void;
  hydrate: () => Promise<void>;
  setStateFromServer: (s: AppState) => void;
  importJson: (text: string) => Promise<boolean>;
  commit: (updater: (draft: AppState) => void) => Promise<boolean>;
  clearAllRecipes: () => Promise<boolean>;
  clearAllShopping: () => Promise<boolean>;
  flushPendingSync: () => Promise<void>;
  resetSession: () => void;
};

type SessionStamp = { gen: number; token: string | null };

let mutationQueue: Promise<unknown> = Promise.resolve();

/** Une seule écriture d’état à la fois : le flush ne doit pas croiser l’enregistrement en cours. */
function enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(task, task);
  mutationQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function stampSession(): SessionStamp {
  return { gen: authGeneration(), token: getAuthToken() };
}

function sameSession(session: SessionStamp): boolean {
  return (
    session.gen === authGeneration() &&
    tenantCacheKeyFromToken(getAuthToken()) === tenantCacheKeyFromToken(session.token)
  );
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

async function persistCache(
  state: AppState,
  pendingSync: boolean,
  session: SessionStamp
): Promise<void> {
  if (!sameSession(session)) return;
  const key = tenantCacheKeyFromToken(session.token);
  if (!key) return;
  try {
    await saveAppCache(key, state, pendingSync);
  } catch {
    /* IndexedDB indisponible (mode privé strict, etc.) */
  }
}

export const useAppStore = create<AppStore>((set, get) => ({
  state: null,
  error: null,
  loading: false,
  pendingSync: false,
  setError: (e) => set({ error: e }),
  resetSession: () => set({ state: null, error: null, loading: false, pendingSync: false }),

  hydrate: async () => {
    const session = stampSession();
    set({ loading: true, error: null, state: null, pendingSync: false });
    try {
      let raw = await apiGetState(session.token);
      const key = getTenantCacheKey();
      let needPersistMigrate = false;
      if (key) {
        const r = mergeLegacyLocalStoragePrompts(key, raw);
        raw = r.state;
        needPersistMigrate = r.migrated;
      }
      let s = normalizeAppState(raw);

      if (!sameSession(session)) return;
      if (needPersistMigrate && key) {
        const online = typeof navigator !== "undefined" && navigator.onLine;
        if (online) {
          try {
            const res = await apiPutState(s.version, s, session.token);
            if (res.ok) {
              s = normalizeAppState(res.state);
              markLegacyPromptImportDone(key);
            }
          } catch {
            if (!sameSession(session)) return;
            await persistCache(s, true, session);
            set({
              state: s,
              loading: false,
              pendingSync: true,
              error: null,
            });
            return;
          }
        } else {
          if (!sameSession(session)) return;
          await persistCache(s, true, session);
          set({
            state: s,
            loading: false,
            pendingSync: true,
            error: null,
          });
          return;
        }
      }

      if (!sameSession(session)) return;
      set({ state: s, loading: false, pendingSync: false });
      void persistCache(s, false, session);
    } catch (e) {
      if (!sameSession(session)) return;
      const key = getTenantCacheKey();
      if (key) {
        try {
          const row = await loadAppCache(key);
          if (!sameSession(session)) return;
          if (row?.state) {
            set({
              state: normalizeAppState(row.state),
              loading: false,
              pendingSync: row.pendingSync,
              error: row.pendingSync
                ? i18n.t("errors:offline_pending")
                : i18n.t("errors:offline_cache"),
            });
            return;
          }
        } catch {
          /* ignore */
        }
      }
      set({
        error:
          e instanceof Error ? e.message : i18n.t("errors:load_network"),
        loading: false,
      });
    }
  },

  setStateFromServer: (s) => {
    const session = stampSession();
    if (get().pendingSync || !sameSession(session)) return;
    const next = normalizeAppState(s);
    set({ state: next, pendingSync: false });
    void persistCache(next, false, session);
  },

  importJson: async (text) => {
    const session = stampSession();
    set({ error: null });
    try {
      const s = normalizeAppState(await apiImportJson(text, session.token));
      if (!sameSession(session)) return false;
      set({ state: s, pendingSync: false });
      void persistCache(s, false, session);
      return true;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : i18n.t("errors:import_failed"),
      });
      return false;
    }
  },

  commit: async (updater) => {
    const session = stampSession();
    const cur = get().state;
    if (!cur) return false;
    const next = clone(cur);
    updater(next);
    const normalized = normalizeAppState(next);
    const expectedVersion = cur.version;
    normalized.version = expectedVersion;
    const online = typeof navigator !== "undefined" && navigator.onLine;

    set({ state: normalized, pendingSync: true, error: null });
    void persistCache(normalized, true, session);

    if (!online) {
      return true;
    }

    return enqueueMutation(async () => {
      if (!sameSession(session)) return false;
      try {
        let res = await apiPutState(expectedVersion, normalized, session.token);
        if (!sameSession(session)) return false;
        if (res.ok) {
          const st = normalizeAppState(res.state);
          set({ state: st, pendingSync: false, error: null });
          void persistCache(st, false, session);
          return true;
        }
        if (!res.conflict) {
          set({ state: cur, error: res.message, pendingSync: false });
          void persistCache(cur, false, session);
          return false;
        }
        let server = normalizeAppState(res.conflict);
        let merged = mergeServerWithLocalDraft(server, normalized);
        set({ state: merged, error: res.message, pendingSync: true });
        void persistCache(merged, true, session);
        res = await apiPutState(server.version, merged, session.token);
        if (!sameSession(session)) return false;
        if (res.ok) {
          const st = normalizeAppState(res.state);
          set({ state: st, pendingSync: false, error: null });
          void persistCache(st, false, session);
          return true;
        }
        if (!res.conflict) {
          set({ state: cur, error: res.message, pendingSync: false });
          void persistCache(cur, false, session);
          return false;
        }
        server = normalizeAppState(res.conflict);
        merged = mergeServerWithLocalDraft(server, get().state ?? merged);
        set({
          state: merged,
          error: res.message,
          pendingSync: true,
        });
        void persistCache(merged, true, session);
        return false;
      } catch {
        return sameSession(session);
      }
    });
  },

  clearAllRecipes: async () => {
    const session = stampSession();
    const cur = get().state;
    if (!cur) return false;
    const online = typeof navigator !== "undefined" && navigator.onLine;
    if (!online || get().pendingSync) {
      set({
        error: get().pendingSync
          ? i18n.t("errors:sync_first")
          : i18n.t("errors:online_required_clear_recipes"),
      });
      return false;
    }
    set({ error: null });
    try {
      const res = await apiClearRecipes(cur.version, session.token);
      if (!sameSession(session)) return false;
      if (res.ok) {
        const st = normalizeAppState(res.state);
        set({ state: st, pendingSync: false, error: null });
        void persistCache(st, false, session);
        return true;
      }
      if (!res.conflict) {
        set({ error: res.message, pendingSync: false });
        return false;
      }
      const conflict = normalizeAppState(res.conflict);
      set({
        state: conflict,
        error: res.message,
        pendingSync: false,
      });
      void persistCache(conflict, false, session);
      return false;
    } catch (e) {
      set({
        error:
          e instanceof Error ? e.message : i18n.t("errors:clear_recipes_failed"),
      });
      return false;
    }
  },

  clearAllShopping: async () => {
    const session = stampSession();
    const cur = get().state;
    if (!cur) return false;
    const online = typeof navigator !== "undefined" && navigator.onLine;
    if (!online || get().pendingSync) {
      set({
        error: get().pendingSync
          ? i18n.t("errors:sync_first")
          : i18n.t("errors:online_required_clear_shopping"),
      });
      return false;
    }
    set({ error: null });
    try {
      const res = await apiClearShopping(cur.version, session.token);
      if (!sameSession(session)) return false;
      if (res.ok) {
        const st = normalizeAppState(res.state);
        set({ state: st, pendingSync: false, error: null });
        void persistCache(st, false, session);
        return true;
      }
      if (!res.conflict) {
        set({ error: res.message, pendingSync: false });
        return false;
      }
      const conflict = normalizeAppState(res.conflict);
      set({
        state: conflict,
        error: res.message,
        pendingSync: false,
      });
      void persistCache(conflict, false, session);
      return false;
    } catch (e) {
      set({
        error:
          e instanceof Error ? e.message : i18n.t("errors:clear_shopping_list_failed"),
      });
      return false;
    }
  },

  flushPendingSync: () =>
    enqueueMutation(async () => {
      const session = stampSession();
      const { pendingSync, state } = get();
      if (!pendingSync || !state) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      try {
        let server = normalizeAppState(await apiGetState(session.token));
        if (!sameSession(session)) return;
        let merged = mergeServerWithLocalDraft(server, state);
        let res = await apiPutState(server.version, merged, session.token);
        if (!sameSession(session)) return;
        if (res.ok) {
          const st = normalizeAppState(res.state);
          set({ state: st, pendingSync: false, error: null });
          void persistCache(st, false, session);
          return;
        }
        if (!res.conflict) return;
        server = normalizeAppState(res.conflict);
        merged = mergeServerWithLocalDraft(server, state);
        res = await apiPutState(server.version, merged, session.token);
        if (!sameSession(session)) return;
        if (res.ok) {
          const st = normalizeAppState(res.state);
          set({ state: st, pendingSync: false, error: null });
          void persistCache(st, false, session);
        }
      } catch {
        /* toujours hors ligne ou erreur */
      }
    }),
}));
