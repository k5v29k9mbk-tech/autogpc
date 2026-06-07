// Shared building blocks for the auth screens: the full-screen shell, the
// password input with a reveal toggle, inline error rows, form banners, and the
// future-provider seam buttons (Google / CAC) — present but deliberately
// disabled this sprint.

import { useId, useState, type ReactNode } from "react";
import { Logo } from "../../components/Logo";
import {
  IconAlert,
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
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card reveal">
        <div className="auth-brand">
          <Logo size={64} />
        </div>
        <div className="auth-head">
          <h1>{title}</h1>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
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
 *   (b) CAC/PIV — server-side mutual TLS + DoD cert-chain at the proxy; never
 *       through Supabase. Placeholder only.
 */
export function ProviderSeams({
  onGoogle,
  busy,
}: {
  /** When provided, the Google button is live and calls this on click. */
  onGoogle?: () => void;
  /** Disable the button while a redirect is in flight. */
  busy?: boolean;
}) {
  return (
    <>
      <div className="auth-or">or</div>
      <div className="stack" style={{ gap: "var(--s2)" }}>
        <button
          type="button"
          className="btn btn-block"
          onClick={onGoogle}
          disabled={!onGoogle || busy}
          aria-disabled={!onGoogle || busy ? "true" : undefined}
          title={
            onGoogle
              ? "Continue with your Google account"
              : "Google sign-in isn't enabled yet."
          }
        >
          <IconGoogle />
          {busy ? "Redirecting to Google…" : "Continue with Google"}
          {!onGoogle && (
            <span className="tag" style={{ marginLeft: "auto" }}>
              soon
            </span>
          )}
        </button>
        <button
          type="button"
          className="btn btn-block"
          disabled
          aria-disabled="true"
          title="CAC / PIV sign-in runs at the proxy (mutual TLS + DoD cert chain), not through Supabase. Arrives with the GovCloud backend."
        >
          <IconShield width={18} height={18} />
          Sign in with CAC / PIV
          <span className="tag" style={{ marginLeft: "auto" }}>
            GovCloud
          </span>
        </button>
      </div>
    </>
  );
}
