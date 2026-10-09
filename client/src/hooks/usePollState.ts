import { useEffect, useRef } from "react";
import { apiGetState } from "@/api/client";
import { authGeneration, getAuthToken } from "@/lib/authToken";
import { useAppStore } from "@/store/useAppStore";

const INTERVAL_MS = 5000;

export function usePollState(enabled: boolean): void {
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled || !getAuthToken()) return;

    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      const generation = authGeneration();
      const token = getAuthToken();
      try {
        const remote = await apiGetState(token);
        if (generation !== authGeneration()) return;
        const { state: local, pendingSync } = useAppStore.getState();
        if (pendingSync) return;
        if (!local || remote.version !== local.version) {
          useAppStore.getState().setStateFromServer(remote);
        }
      } catch {
        /* offline */
      } finally {
        busy.current = false;
      }
    };

    const id = window.setInterval(tick, INTERVAL_MS);
    void tick();
    return () => window.clearInterval(id);
  }, [enabled]);
}
