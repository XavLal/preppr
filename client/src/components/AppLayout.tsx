import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearAuthToken } from "@/lib/authToken";
import { clearAppCache } from "@/lib/offlineDb";
import { getTenantCacheKey } from "@/lib/tenantCacheKey";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePollState } from "@/hooks/usePollState";
import { useAppStore } from "@/store/useAppStore";

export default function AppLayout() {
  const nav = useNavigate();
  const online = useOnlineStatus();
  const pendingSync = useAppStore((s) => s.pendingSync);
  const flushPendingSync = useAppStore((s) => s.flushPendingSync);

  usePollState(true);

  useEffect(() => {
    if (online && pendingSync) {
      void flushPendingSync();
    }
  }, [online, pendingSync, flushPendingSync]);

  useEffect(() => {
    const onUp = () => {
      void useAppStore.getState().flushPendingSync();
    };
    window.addEventListener("online", onUp);
    return () => window.removeEventListener("online", onUp);
  }, []);

  function logout() {
    const key = getTenantCacheKey();
    clearAuthToken();
    if (key) void clearAppCache(key);
    nav("/login", { replace: true });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Meal planner
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>
            Accueil
          </NavLink>
          <NavLink to="/courses">Courses</NavLink>
          {!online ? (
            <span className="offline-badge" title="Pas de connexion réseau">
              Hors ligne
            </span>
          ) : null}
          {online && pendingSync ? (
            <span className="sync-badge" title="Envoi des changements…">
              À synchroniser
            </span>
          ) : null}
          <button type="button" className="btn ghost" onClick={logout}>
            Déconnexion
          </button>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
