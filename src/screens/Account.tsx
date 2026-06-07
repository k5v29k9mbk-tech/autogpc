import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, AuthError } from "../auth";
import { IconLogOut, IconMail, IconShield } from "../components/icons";

export function Account() {
  const { mode, user, requestPasswordReset, logout } = useAuth();
  const navigate = useNavigate();
  const [pwState, setPwState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const changePassword = async () => {
    if (!user?.email) return;
    setError(null);
    setPwState("sending");
    try {
      await requestPasswordReset(user.email);
      setPwState("sent");
    } catch (err) {
      setPwState("idle");
      setError(err instanceof AuthError ? err.message : "Could not send the reset email.");
    }
  };

  // Guests have no account to manage.
  if (mode !== "authenticated" || !user) {
    return (
      <div className="stack" style={{ gap: "var(--s5)" }}>
        <div className="page-head">
          <h1>Account</h1>
        </div>
        <div className="empty">
          You're browsing as a guest — no account is attached.{" "}
          <Link to="/login" style={{ color: "var(--text)" }}>
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s5)", maxWidth: 560 }}>
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>Your account</h1>
        <p className="sub">Manage how you sign in to AutoGPC.</p>
      </div>

      <div className="card">
        <div className="kv">
          <span className="muted row" style={{ gap: "var(--s2)" }}>
            <IconMail width={15} height={15} /> Email
          </span>
          <span>{user.email}</span>
          <span className="muted row" style={{ gap: "var(--s2)" }}>
            <IconShield width={15} height={15} /> Status
          </span>
          <span>{user.emailConfirmed ? "Email confirmed" : "Email not confirmed"}</span>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title" style={{ margin: 0 }}>
          Password
        </h2>
        <p className="muted" style={{ fontSize: 14, margin: "var(--s2) 0 var(--s4)" }}>
          We'll email a secure link to <strong style={{ color: "var(--text)" }}>{user.email}</strong>{" "}
          where you can set a new password.
        </p>
        {error && <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: "var(--s3)" }}>{error}</div>}
        {pwState === "sent" ? (
          <div className="row" style={{ gap: "var(--s2)", color: "var(--accent-text)" }}>
            <IconMail width={15} height={15} /> Reset link sent — check your inbox.
          </div>
        ) : (
          <button className="btn" onClick={changePassword} disabled={pwState === "sending"}>
            {pwState === "sending" ? "Sending…" : "Change password"}
          </button>
        )}
      </div>

      <div className="row">
        <button className="btn btn-ghost" onClick={signOut}>
          <IconLogOut width={15} height={15} /> Sign out
        </button>
      </div>
    </div>
  );
}
