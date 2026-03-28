import { create } from "zustand";
import { apiGetState, apiImportJson, apiPutState } from "@/api/client";
import type { AppState } from "@/types";

type AppStore = {
  state: AppState | null;
  error: string | null;
  loading: boolean;
  setError: (e: string | null) => void;
  hydrate: () => Promise<void>;
  setStateFromServer: (s: AppState) => void;
  importJson: (text: string) => Promise<boolean>;
  commit: (updater: (draft: AppState) => void) => Promise<boolean>;
};

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export const useAppStore = create<AppStore>((set, get) => ({
  state: null,
  error: null,
  loading: false,
  setError: (e) => set({ error: e }),
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const s = await apiGetState();
      set({ state: s, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Erreur réseau",
        loading: false,
      });
    }
  },
  setStateFromServer: (s) => set({ state: s }),
  importJson: async (text) => {
    set({ error: null });
    try {
      const s = await apiImportJson(text);
      set({ state: s });
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
    try {
      const res = await apiPutState(expectedVersion, next);
      if (res.ok) {
        set({ state: res.state, error: null });
        return true;
      }
      set({
        state: res.conflict,
        error: res.message,
      });
      return false;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Enregistrement impossible",
      });
      return false;
    }
  },
}));
