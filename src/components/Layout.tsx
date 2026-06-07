import { NavLink, Outlet } from "react-router-dom";
import { Logo } from "./Logo";
import { GuestBanner } from "./GuestBanner";
import { AccountMenu } from "./AccountMenu";

export function Layout() {
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

          <AccountMenu />
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
