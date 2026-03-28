import { create } from "zustand";
import {
  apiClearRecipes,
  apiClearShopping,
  apiGetState,
  apiImportJson,
  apiPutState,
} from "@/api/client";
import { mergeServerWithLocalDraft } from "@/lib/mergeOfflineState";
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
      const s = await apiGetState();
      set({ state: s, loading: false, pendingSync: false });
      void persistCache(s, false);
    } catch (e) {
      const key = getTenantCacheKey();
      if (key) {
        try {
          const row = await loadAppCache(key);
          if (row?.state) {
            set({
              state: row.state,
              loading: false,
              pendingSync: row.pendingSync,
              error: row.pendingSync
                ? "Hors ligne — vos changements seront envoyés au retour du réseau."
                : "Hors ligne — affichage des dernières données en cache.",
            });
            return;
          }
        } catch {
          /* ignore */
        }
      }
      set({
        error:
          e instanceof Error
            ? e.message
            : "Impossible de charger les données (réseau ou serveur).",
        loading: false,
      });
    }
  },

  setStateFromServer: (s) => {
    if (get().pendingSync) return;
    set({ state: s, pendingSync: false });
    void persistCache(s, false);
  },

  importJson: async (text) => {
    set({ error: null });
    try {
      const s = await apiImportJson(text);
      set({ state: s, pendingSync: false });
      void persistCache(s, false);
      return true;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Import impossible",
      });
      return false;
    }
  },

  commit: async (updater) => {
    const cur = get().state;
    if (!cur) return false;
    const next = clone(cur);
    updater(next);
    const expectedVersion = cur.version;
    const online = typeof navigator !== "undefined" && navigator.onLine;

    if (!online) {
      next.version = cur.version;
      set({ state: next, pendingSync: true, error: null });
      void persistCache(next, true);
      return true;
    }

    try {
      const res = await apiPutState(expectedVersion, next);
      if (res.ok) {
        set({ state: res.state, pendingSync: false, error: null });
        void persistCache(res.state, false);
        return true;
      }
      set({
        state: res.conflict,
        error: res.message,
        pendingSync: false,
      });
      void persistCache(res.conflict, false);
      return false;
    } catch {
      next.version = cur.version;
      set({ state: next, pendingSync: true, error: null });
      void persistCache(next, true);
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
          ? "Synchronisez d’abord les changements en attente."
          : "Connexion requise pour supprimer toutes les recettes.",
      });
      return false;
    }
    set({ error: null });
    try {
      const res = await apiClearRecipes(cur.version);
      if (res.ok) {
        set({ state: res.state, pendingSync: false, error: null });
        void persistCache(res.state, false);
        return true;
      }
      set({
        state: res.conflict,
        error: res.message,
        pendingSync: false,
      });
      void persistCache(res.conflict, false);
      return false;
    } catch (e) {
      set({
        error:
          e instanceof Error ? e.message : "Suppression de toutes les recettes impossible.",
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
          ? "Synchronisez d’abord les changements en attente."
          : "Connexion requise pour vider la liste de courses.",
      });
      return false;
    }
    set({ error: null });
    try {
      const res = await apiClearShopping(cur.version);
      if (res.ok) {
        set({ state: res.state, pendingSync: false, error: null });
        void persistCache(res.state, false);
        return true;
      }
      set({
        state: res.conflict,
        error: res.message,
        pendingSync: false,
      });
      void persistCache(res.conflict, false);
      return false;
    } catch (e) {
      set({
        error:
          e instanceof Error ? e.message : "Impossible de vider la liste de courses.",
      });
      return false;
    }
  },

  flushPendingSync: async () => {
    const { pendingSync, state } = get();
    if (!pendingSync || !state) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      let server = await apiGetState();
      let merged = mergeServerWithLocalDraft(server, state);
      let res = await apiPutState(server.version, merged);
      if (res.ok) {
        set({ state: res.state, pendingSync: false, error: null });
        void persistCache(res.state, false);
        return;
      }
      server = res.conflict;
      merged = mergeServerWithLocalDraft(server, state);
      res = await apiPutState(server.version, merged);
      if (res.ok) {
        set({ state: res.state, pendingSync: false, error: null });
        void persistCache(res.state, false);
      }
    } catch {
      /* toujours hors ligne ou erreur */
    }
  },
}));
