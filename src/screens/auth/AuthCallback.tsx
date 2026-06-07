import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, AuthError } from "../../auth";
import { AuthShell, Banner } from "./authShared";
import { IconCheck } from "../../components/icons";

type Phase =
  | { kind: "working" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/**
 * Lands here from an email-confirmation link OR an OAuth redirect (Google /
 * Apple) — both return a PKCE `code` we exchange for a session. Routes into the
 * app on success
 * or shows a clear error with a path back to sign-in.
 */
export function AuthCallback() {
  const { completeEmailConfirmation } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  // StrictMode double-invokes effects in dev; the auth code is single-use, so
  // guard against running the exchange twice.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        await completeEmailConfirmation(window.location.href);
        setPhase({ kind: "success" });
        // Clean the token out of the address bar, then head into the app.
        window.history.replaceState({}, "", "/auth/callback");
        setTimeout(() => navigate("/", { replace: true }), 1200);
      } catch (err) {
        const message =
          err instanceof AuthError
            ? err.message
            : "We couldn't complete sign-in. The link may have expired.";
        setPhase({ kind: "error", message });
      }
    })();
  }, [completeEmailConfirmation, navigate]);

  if (phase.kind === "working") {
    return (
      <AuthShell title="Signing you in…">
        <div className="row" style={{ justifyContent: "center", color: "var(--text-muted)" }}>
          <span className="spinner" />
          <span>Completing sign-in.</span>
        </div>
      </AuthShell>
    );
  }

  if (phase.kind === "success") {
    return (
      <AuthShell title="Signed in">
        <div className="stack" style={{ textAlign: "center" }}>
          <div className="row" style={{ justifyContent: "center" }}>
            <span className="check" style={{ width: 40, height: 40 }}>
              <IconCheck width={22} height={22} />
            </span>
          </div>
          <Banner variant="success">You're signed in. Taking you into AutoGPC…</Banner>
          <Link to="/" className="btn btn-primary btn-block">
            Continue
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Confirmation failed"
      footer={<Link to="/login">Back to sign in</Link>}
    >
      <div className="stack">
        <Banner variant="error">{phase.message}</Banner>
        <p className="pw-hint" style={{ textAlign: "center" }}>
          Try signing in — if your email still isn't confirmed, you can resend the link from there.
        </p>
        <Link to="/login" className="btn btn-primary btn-block">
          Go to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
