import { NavLink, Outlet } from "react-router-dom";
import { Logo } from "./Logo";

export function Layout() {
  return (
    <div className="app">
      <header className="nav">
        <div className="container nav-inner">
          <NavLink to="/" className="brand" aria-label="Nexus home">
            <Logo size={30} className="mark" />
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
              Scan / Upload
            </NavLink>
            <NavLink
              to="/records"
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              Records
            </NavLink>
          </nav>

          <div className="spacer" />
          <span className="trust-chip" title="Sprint 1 runs entirely client-side. Nothing leaves the device.">
            <span className="dot" />
            Runs on this device
          </span>
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
