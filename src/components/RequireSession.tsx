// Route guard for the app shell. Lets in authenticated users AND guests;
// sends true anonymous visitors to the sign-in gate. Note: this is UX gating
// only — actual data protection comes from Row Level Security on the backend,
// never from this client-side check.

import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth";

export function RequireSession({ children }: { children: ReactNode }) {
  const { status, mode } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="auth-shell">
        <div className="row" style={{ color: "var(--text-muted)" }}>
          <span className="spinner" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (mode === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
