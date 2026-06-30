// Shared building blocks for the auth screens: the full-screen shell, the
// password input with a reveal toggle, inline error rows, form banners, and the
// future-provider seam buttons (Google / CAC) — present but deliberately
// disabled this sprint.

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../../components/Logo";
import {
  IconAlert,
  IconApple,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconGoogle,
  IconShield,
} from "../../components/icons";

/** Centered, full-screen frame used by every pre-app auth screen. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card reveal">
        <div className="auth-brand">
          <Logo size={120} />
          <span className="wordmark">Nexus</span>
        </div>
        {(title || subtitle) && (
          <div className="auth-head">
            {title && <h1>{title}</h1>}
            {subtitle && <p className="sub">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
      {footer && <div className="auth-foot">{footer}</div>}
    </div>
  );
}

/** Form-level banner. variant drives color: error (clay) / success (green) / info. */
export function Banner({
  variant,
  children,
}: {
  variant: "error" | "success" | "info";
  children: ReactNode;
}) {
  const Icon = variant === "success" ? IconCheck : IconAlert;
  const cls = variant === "error" ? "alert-error" : variant === "success" ? "alert-success" : "";
  return (
    <div className={`alert ${cls}`} role={variant === "error" ? "alert" : "status"}>
      <Icon width={16} height={16} />
      <div>{children}</div>
    </div>
  );
}

/** Inline, per-field error text wired to the input via aria-describedby. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span className="field-error" id={id}>
      <IconAlert width={12} height={12} />
      {children}
    </span>
  );
}

/**
 * Clickwrap consent checkbox + liability disclaimer, linking to /terms. Shared
 * by the signup form and the OAuth consent gate so the wording stays identical.
 * Unchecked by default; the caller gates account creation on `checked`.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string | null;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="consent" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <span>
          I understand AutoGPC automates work on my behalf, that extractions and uploads may be
          wrong or irreversible, that I am responsible for verifying every result before relying on
          it, and I accept the{" "}
          <Link to="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Use &amp; Disclaimer
          </Link>
          .
        </span>
      </label>
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  );
}

/** Password field with a show/hide reveal toggle. */
export function PasswordInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  autoComplete,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
}) {
  const [shown, setShown] = useState(false);
  const labelId = useId();
  return (
    <div className="input-wrap">
      <input
        id={id}
        type={shown ? "text" : "password"}
        className={`input${invalid ? " invalid" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        className="input-affix"
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        title={shown ? "Hide password" : "Show password"}
        id={labelId}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <IconEyeOff width={17} height={17} /> : <IconEye width={17} height={17} />}
      </button>
    </div>
  );
}

/**
 * Provider seams below the email/password form.
 *   (a) Google  — live via Supabase signInWithOAuth when `onGoogle` is passed
 *       (and the provider is enabled in the dashboard). Disabled otherwise.
 *   (b) Apple   — live via Supabase signInWithOAuth when `onApple` is passed
 *       (and the provider is enabled in the dashboard). Disabled otherwise.
 *   (c) CAC/PIV — server-side mutual TLS + DoD cert-chain at the proxy; never
 *       through Supabase. Placeholder only.
 *
 * `busy` tracks which provider's redirect is in flight (or none), so only the
 * clicked button shows its loading label while both stay disabled.
 */
export function ProviderSeams({
  onGoogle,
  onApple,
  busy,
}: {
  /** When provided, the Google button is live and calls this on click. */
  onGoogle?: () => void;
  /** When provided, the Apple button is live and calls this on click. */
  onApple?: () => void;
  /** Which provider's redirect is in flight (disables both buttons). */
  busy?: "google" | "apple" | null;
}) {
  const anyBusy = busy != null;
  // Pin the "soon" tag to the right edge so the icon + label stay centered in
  // the button (like the live Google button), rather than being pushed left by
  // a margin-auto tag.
  const tagStyle: CSSProperties = {
    position: "absolute",
    right: "var(--s3)",
    top: "50%",
    transform: "translateY(-50%)",
  };
  return (
    <>
      <div className="auth-or">or</div>
      <div className="stack" style={{ gap: "var(--s2)" }}>
        <button
          type="button"
          className="btn btn-block"
          style={{ position: "relative" }}
          onClick={onGoogle}
          disabled={!onGoogle || anyBusy}
          aria-disabled={!onGoogle || anyBusy ? "true" : undefined}
          title={
            onGoogle
              ? "Continue with your Google account"
              : "Google sign-in isn't enabled yet."
          }
        >
          <IconGoogle />
          {busy === "google" ? "Redirecting to Google…" : "Continue with Google"}
          {!onGoogle && (
            <span className="tag" style={tagStyle}>
              soon
            </span>
          )}
        </button>
        <button
          type="button"
          className="btn btn-block"
          style={{ position: "relative" }}
          onClick={onApple}
          disabled={!onApple || anyBusy}
          aria-disabled={!onApple || anyBusy ? "true" : undefined}
          title={
            onApple
              ? "Continue with your Apple account"
              : "Apple sign-in isn't enabled yet."
          }
        >
          <IconApple />
          {busy === "apple" ? "Redirecting to Apple…" : "Continue with Apple"}
          {!onApple && (
            <span className="tag" style={tagStyle}>
              soon
            </span>
          )}
        </button>
        <button
          type="button"
          className="btn btn-block"
          style={{ position: "relative" }}
          disabled
          aria-disabled="true"
          title="CAC / PIV sign-in runs at the proxy (mutual TLS + DoD cert chain), not through Supabase. Arrives with the GovCloud backend."
        >
          <IconShield width={18} height={18} />
          Sign in with CAC / PIV
          <span className="tag" style={tagStyle}>
            soon
          </span>
        </button>
      </div>
    </>
  );
}
