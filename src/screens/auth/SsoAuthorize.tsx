import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { validateRedirectUri } from "../../lib/sso";
import { AuthShell, Banner } from "./authShared";

/**
 * SSO handoff endpoint — "Sign in with Nexus" for partner apps (e.g. the US Bank
 * Access Online mock at test.autogpc.com).
 *
 * A partner sends the user here with ?redirect_uri=<their callback>&state=<csrf>.
 * If the visitor isn't signed into Nexus we show the gate (their own login lives
 * here). Once authenticated, we put the current access token in the partner's
 * redirect_uri fragment and bounce back. The partner verifies that token
 * server-side and mints its own session — Nexus stays the single identity.
 *
 * The redirect_uri is checked against an allow-list (src/lib/sso) BEFORE any
 * token is attached, so a hostile link can't exfiltrate a user's token.
 */
export function SsoAuthorize() {
  const { status, mode, getAccessToken } = useAuth();
  const [params] = useSearchParams();
  const redirectUri = params.get("redirect_uri") ?? "";
  const state = params.get("state") ?? "";
  const partner = validateRedirectUri(redirectUri);
  const [error, setError] = useState<string | null>(null);
  // Hand off exactly once (StrictMode double-invokes effects in dev).
  const handed = useRef(false);

  useEffect(() => {
    if (!partner.ok || status !== "ready" || mode !== "authenticated" || handed.current) return;
    handed.current = true;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setError("Your session has no access token. Please sign in again.");
          handed.current = false;
          return;
        }
        const url = new URL(redirectUri);
        const fragment = new URLSearchParams({ access_token: token, token_type: "bearer" });
        if (state) fragment.set("state", state);
        url.hash = fragment.toString();
        window.location.replace(url.toString());
      } catch {
        setError("Could not complete sign-in. Please try again.");
        handed.current = false;
      }
    })();
  }, [partner.ok, status, mode, getAccessToken, redirectUri, state]);

  // 1. Bad or disallowed return address — never redirect; explain why.
  if (!partner.ok) {
    return (
      <AuthShell title="Sign-in request blocked" footer={<Link to="/">Go to Nexus</Link>}>
        <Banner variant="error">{partner.reason}</Banner>
        <p className="pw-hint" style={{ textAlign: "center", marginTop: "var(--s2)" }}>
          For your security, Nexus only returns sign-in tokens to approved applications.
        </p>
      </AuthShell>
    );
  }

  // 2. Still probing the session.
  if (status !== "ready") {
    return (
      <AuthShell title="Connecting…">
        <div className="row" style={{ justifyContent: "center", color: "var(--text-muted)" }}>
          <span className="spinner" />
          <span>Checking your Nexus session…</span>
        </div>
      </AuthShell>
    );
  }

  // 3. Not signed in (anonymous or guest). Prompt rather than auto-redirect, so
  //    a guest doesn't bounce in a loop. Login returns here via ?next.
  if (mode !== "authenticated") {
    const next = `/sso/authorize?${params.toString()}`;
    return (
      <AuthShell
        title="Sign in to continue"
        subtitle={`to continue to ${partner.label}`}
        footer={
          <>
            New here? <Link to="/create-account">Create an account</Link>
          </>
        }
      >
        <div className="stack">
          <Banner variant="info">{partner.label} uses your Nexus account to sign you in.</Banner>
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="btn btn-primary btn-block">
            Sign in with Nexus
          </Link>
        </div>
      </AuthShell>
    );
  }

  // 4. Authenticated — handing the token back (or reporting a failure).
  return (
    <AuthShell title="Connecting…" footer={error ? <Link to="/">Go to Nexus</Link> : undefined}>
      {error ? (
        <Banner variant="error">{error}</Banner>
      ) : (
        <div className="row" style={{ justifyContent: "center", color: "var(--text-muted)" }}>
          <span className="spinner" />
          <span>Returning you to {partner.label}…</span>
        </div>
      )}
    </AuthShell>
  );
}
