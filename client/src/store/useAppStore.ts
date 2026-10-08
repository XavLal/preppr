import i18n from "@/i18n";
import { create } from "zustand";
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
import { getTenantCacheKey } from "@/lib/tenantCacheKey";
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
};

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

async function persistCache(state: AppState, pendingSync: boolean): Promise<void> {
  const key = getTenantCacheKey();
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

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      let raw = await apiGetState();
      const key = getTenantCacheKey();
      let needPersistMigrate = false;
      if (key) {
        const r = mergeLegacyLocalStoragePrompts(key, raw);
        raw = r.state;
        needPersistMigrate = r.migrated;
      }
      let s = normalizeAppState(raw);

      if (needPersistMigrate && key) {
        const online = typeof navigator !== "undefined" && navigator.onLine;
        if (online) {
          try {
            const res = await apiPutState(s.version, s);
            if (res.ok) {
              s = normalizeAppState(res.state);
              markLegacyPromptImportDone(key);
            }
          } catch {
            await persistCache(s, true);
            set({
              state: s,
              loading: false,
              pendingSync: true,
              error: null,
            });
            return;
          }
        } else {
          await persistCache(s, true);
          set({
            state: s,
            loading: false,
            pendingSync: true,
            error: null,
          });
          return;
        }
      }

      set({ state: s, loading: false, pendingSync: false });
      void persistCache(s, false);
    } catch (e) {
      const key = getTenantCacheKey();
      if (key) {
        try {
          const row = await loadAppCache(key);
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
    if (get().pendingSync) return;
    const next = normalizeAppState(s);
    set({ state: next, pendingSync: false });
    void persistCache(next, false);
  },

  importJson: async (text) => {
    set({ error: null });
    try {
      const s = normalizeAppState(await apiImportJson(text));
      set({ state: s, pendingSync: false });
      void persistCache(s, false);
      return true;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : i18n.t("errors:import_failed"),
      });
      return false;
    }
  },

  commit: async (updater) => {
    const cur = get().state;
    if (!cur) return false;
    const next = clone(cur);
    updater(next);
    const normalized = normalizeAppState(next);
    const expectedVersion = cur.version;
    normalized.version = expectedVersion;
    const online = typeof navigator !== "undefined" && navigator.onLine;

    set({ state: normalized, pendingSync: true, error: null });
    void persistCache(normalized, true);

    if (!online) {
      return true;
    }

    try {
      let res = await apiPutState(expectedVersion, normalized);
      if (res.ok) {
        const st = normalizeAppState(res.state);
        set({ state: st, pendingSync: false, error: null });
        void persistCache(st, false);
        return true;
      }
      let server = normalizeAppState(res.conflict);
      let merged = mergeServerWithLocalDraft(server, normalized);
      set({ state: merged, error: res.message, pendingSync: true });
      void persistCache(merged, true);
      res = await apiPutState(server.version, merged);
      if (res.ok) {
        const st = normalizeAppState(res.state);
        set({ state: st, pendingSync: false, error: null });
        void persistCache(st, false);
        return true;
      }
      server = normalizeAppState(res.conflict);
      merged = mergeServerWithLocalDraft(server, get().state ?? merged);
      set({
        state: merged,
        error: res.message,
        pendingSync: true,
      });
      void persistCache(merged, true);
      return false;
    } catch {
      return true;
    }
  },

  clearAllRecipes: async () => {
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
      const res = await apiClearRecipes(cur.version);
      if (res.ok) {
        const st = normalizeAppState(res.state);
        set({ state: st, pendingSync: false, error: null });
        void persistCache(st, false);
        return true;
      }
      const conflict = normalizeAppState(res.conflict);
      set({
        state: conflict,
        error: res.message,
        pendingSync: false,
      });
      void persistCache(conflict, false);
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
      const res = await apiClearShopping(cur.version);
      if (res.ok) {
        const st = normalizeAppState(res.state);
        set({ state: st, pendingSync: false, error: null });
        void persistCache(st, false);
        return true;
      }
      const conflict = normalizeAppState(res.conflict);
      set({
        state: conflict,
        error: res.message,
        pendingSync: false,
      });
      void persistCache(conflict, false);
      return false;
    } catch (e) {
      set({
        error:
          e instanceof Error ? e.message : i18n.t("errors:clear_shopping_list_failed"),
      });
      return false;
    }
  },

  flushPendingSync: async () => {
    const { pendingSync, state } = get();
    if (!pendingSync || !state) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      let server = normalizeAppState(await apiGetState());
      let merged = mergeServerWithLocalDraft(server, state);
      let res = await apiPutState(server.version, merged);
      if (res.ok) {
        const st = normalizeAppState(res.state);
        set({ state: st, pendingSync: false, error: null });
        void persistCache(st, false);
        return;
      }
      server = normalizeAppState(res.conflict);
      merged = mergeServerWithLocalDraft(server, state);
      res = await apiPutState(server.version, merged);
      if (res.ok) {
        const st = normalizeAppState(res.state);
        set({ state: st, pendingSync: false, error: null });
        void persistCache(st, false);
      }
    } catch {
      /* toujours hors ligne ou erreur */
    }
  },
}));
