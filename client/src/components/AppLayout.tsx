import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearAuthToken } from "@/lib/authToken";
import { clearAppCache } from "@/lib/offlineDb";
import { getTenantCacheKey } from "@/lib/tenantCacheKey";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePollState } from "@/hooks/usePollState";
import { useAppStore } from "@/store/useAppStore";

export default function AppLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const online = useOnlineStatus();
  const pendingSync = useAppStore((s) => s.pendingSync);
  const flushPendingSync = useAppStore((s) => s.flushPendingSync);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", onDocClick);
    return () => window.removeEventListener("mousedown", onDocClick);
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
          Preppr
        </NavLink>
        <nav className="nav nav-primary">
          <NavLink to="/" end>
            Recettes
          </NavLink>
          <NavLink to="/courses">Courses</NavLink>
          <NavLink
            to="/generateur-menus"
            className="nav-ia-link"
            title="Assistant IA"
            aria-label="Assistant IA"
          >
            <span className="material-symbols-outlined ia-symbol" aria-hidden="true">
              generating_tokens
            </span>
          </NavLink>
        </nav>
        <div className="topbar-right">
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
          <div className="topbar-menu" ref={menuRef}>
            <button
              type="button"
              className="btn ghost hamburger-btn"
              aria-label="Ouvrir le menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ☰
            </button>
            {menuOpen ? (
              <div className="hamburger-menu card" role="menu">
                <NavLink to="/parametres" role="menuitem" className="hamburger-item">
                  Paramètres
                </NavLink>
                <button type="button" className="hamburger-item logout-item" onClick={logout}>
                  Déconnexion
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
