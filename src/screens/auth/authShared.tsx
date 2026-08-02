// Shared building blocks for the auth screens: the full-screen shell, the
// password input with a reveal toggle, inline error rows, form banners, and the
// future-provider seam buttons (Google / CAC) — present but deliberately
// disabled this sprint.

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SignInMethod } from "../../auth/lastSignIn";
import { DUTY_STATIONS } from "../../lib/dutyStations";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "../../lib/validation";
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

/**
 * Marks the button for the method the user signed in with last time — a tag on
 * the button itself rather than a sentence above the form. The host button must
 * be position: relative.
 */
export function LastUsedTag() {
  return <span className="tag last-used">Last used</span>;
}

// Stations grouped by country for the <optgroup>s, preserving array order.
// Static data — computed once here, not useMemo'd per screen.
const STATION_GROUPS = DUTY_STATIONS.reduce<{ country: string; stations: typeof DUTY_STATIONS }[]>(
  (groups, s) => {
    const last = groups[groups.length - 1];
    if (last && last.country === s.country) last.stations.push(s);
    else groups.push({ country: s.country, stations: [s] });
    return groups;
  },
  [],
);

/**
 * The duty-station picker (signup and Account previously each hand-rolled it,
 * hint string and all). Sets the OCONUS delivery default for US Bank orders.
 */
export function DutyStationField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>Duty station</label>
      <select
        id={id}
        className={`select${error ? " invalid" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : `${id}-hint`}
      >
        <option value="">— select your base —</option>
        {STATION_GROUPS.map((g) => (
          <optgroup key={g.country} label={g.country}>
            {g.stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {error ? (
        <FieldError id={`${id}-err`}>{error}</FieldError>
      ) : (
        <span className="pw-hint" id={`${id}-hint`}>
          Sets whether your orders deliver outside the US (OCONUS).
        </span>
      )}
    </div>
  );
}

/**
 * A new-password field with the strength meter and the rules hint — the hint
 * derives from MIN_PASSWORD_LENGTH so copy can't lie when the rule changes.
 * (Signup and Account previously each hand-rolled this block.)
 */
export function NewPasswordField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  const strength = value ? passwordStrength(value) : null;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <PasswordInput
        id={id}
        value={value}
        onChange={onChange}
        invalid={!!error}
        autoComplete="new-password"
        describedBy={`${id}-hint${error ? ` ${id}-err` : ""}`}
      />
      {value && (
        <div
          className="pw-meter"
          data-strength={strength}
          role="img"
          aria-label={`Password strength: ${strength}`}
        >
          <span />
          <span />
          <span />
        </div>
      )}
      {error ? (
        <FieldError id={`${id}-err`}>{error}</FieldError>
      ) : (
        <span className="pw-hint" id={`${id}-hint`}>
          At least {MIN_PASSWORD_LENGTH} characters, with a letter and a number.
        </span>
      )}
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
  lastUsed,
}: {
  /** When provided, the Google button is live and calls this on click. */
  onGoogle?: () => void;
  /** When provided, the Apple button is live and calls this on click. */
  onApple?: () => void;
  /** Which provider's redirect is in flight (disables both buttons). */
  busy?: "google" | "apple" | null;
  /** The method this returning user last signed in with, if any. */
  lastUsed?: SignInMethod | null;
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
          {lastUsed === "google" && <LastUsedTag />}
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
          {lastUsed === "apple" && <LastUsedTag />}
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
