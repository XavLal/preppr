import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearAuthToken } from "@/lib/authToken";
import { usePollState } from "@/hooks/usePollState";

export default function AppLayout() {
  const nav = useNavigate();
  usePollState(true);

  function logout() {
    clearAuthToken();
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
