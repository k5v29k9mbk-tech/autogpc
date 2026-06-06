import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { GuestBanner } from "./GuestBanner";
import { IconLogOut, IconUser } from "./icons";
import { useAuth } from "../auth";

export function Layout() {
  const { mode, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">
      <GuestBanner />
      <header className="nav">
        <div className="container nav-inner">
          <NavLink to="/" className="brand" aria-label="Nexus home">
            <Logo size={36} className="mark" />
            <span className="wordmark">Nexus</span>
          </NavLink>

          <nav className="nav-links">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              Home
            </NavLink>
            <NavLink
              to="/scan"
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              Scan
            </NavLink>
            <NavLink
              to="/records"
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              Records
            </NavLink>
          </nav>

          <div className="spacer" />

          {mode === "authenticated" && user ? (
            <span className="account-chip" title={user.email ?? "Signed in"}>
              <IconUser width={14} height={14} />
              <span className="who">{user.email}</span>
            </span>
          ) : (
            <span className="trust-chip" title="Guest mode — records won't be saved to an account.">
              <span className="dot" style={{ background: "var(--warn)" }} />
              Guest
            </span>
          )}

          <button
            className="btn btn-sm btn-ghost signout"
            onClick={handleSignOut}
            title={mode === "guest" ? "Exit guest mode" : "Sign out"}
            aria-label={mode === "guest" ? "Exit guest mode" : "Sign out"}
          >
            <IconLogOut width={15} height={15} />
            <span className="btn-label">{mode === "guest" ? "Exit guest" : "Sign out"}</span>
          </button>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
