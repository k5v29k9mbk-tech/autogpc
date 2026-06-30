import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, AuthError } from "../../auth";
import { AuthShell, Banner, ConsentCheckbox } from "./authShared";
import { IconCheck } from "../../components/icons";
import { TERMS_VERSION } from "../../lib/terms";

type Phase =
  | { kind: "working" }
  | { kind: "success" }
  | { kind: "consent" }
  | { kind: "error"; message: string };

/**
 * Lands here from an email-confirmation link OR an OAuth redirect (Google /
 * Apple) — both return a PKCE `code` we exchange for a session. Routes into the
 * app on success
 * or shows a clear error with a path back to sign-in.
 */
export function AuthCallback() {
  const { completeEmailConfirmation, acceptTerms, logout } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  // StrictMode double-invokes effects in dev; the auth code is single-use, so
  // guard against running the exchange twice.
  const ran = useRef(false);

  const finish = () => {
    setPhase({ kind: "success" });
    // Clean the token out of the address bar, then head into the app.
    window.history.replaceState({}, "", "/auth/callback");
    setTimeout(() => navigate("/", { replace: true }), 1200);
  };

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const user = await completeEmailConfirmation(window.location.href);
        // OAuth accounts don't pass through our signup form, so consent is
        // collected here on first sign-in. Password accounts were stamped at
        // signUp and skip the gate.
        if (user.termsAcceptedVersion !== TERMS_VERSION) {
          window.history.replaceState({}, "", "/auth/callback");
          setPhase({ kind: "consent" });
          return;
        }
        finish();
      } catch (err) {
        const message =
          err instanceof AuthError
            ? err.message
            : "We couldn't complete sign-in. The link may have expired.";
        setPhase({ kind: "error", message });
      }
    })();
  }, [completeEmailConfirmation, navigate]);

  const onAccept = async () => {
    if (!accepted) {
      setConsentError("Please accept the Terms of Use to continue.");
      return;
    }
    setConsentBusy(true);
    setConsentError(null);
    try {
      await acceptTerms();
      finish();
    } catch (err) {
      setConsentBusy(false);
      setConsentError(
        err instanceof AuthError ? err.message : "Could not record your acceptance. Try again.",
      );
    }
  };

  // Declining must not leave an un-consented session live.
  const onDecline = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

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

  if (phase.kind === "consent") {
    return (
      <AuthShell
        title="One more step"
        subtitle="Please review and accept before continuing."
      >
        <div className="stack">
          {consentError && <Banner variant="error">{consentError}</Banner>}
          <ConsentCheckbox
            checked={accepted}
            onChange={(next) => {
              setAccepted(next);
              if (next) setConsentError(null);
            }}
            error={consentError}
          />
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onAccept}
            disabled={consentBusy || !accepted}
          >
            {consentBusy ? <span className="spinner" /> : null}
            {consentBusy ? "Saving…" : "Accept and continue"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={onDecline}
            disabled={consentBusy}
          >
            Decline and sign out
          </button>
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
