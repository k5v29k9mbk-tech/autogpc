import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, AuthError } from "../../auth";
import { validatePassword, validatePasswordConfirm } from "../../lib/validation";
import { AuthShell, Banner, FieldError, PasswordInput } from "./authShared";
import { IconCheck } from "../../components/icons";

type Phase =
  | { kind: "verifying" }
  | { kind: "ready" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * Landing for a password-reset link. First exchanges the recovery code for a
 * session (same PKCE exchange as email confirmation), then collects a new
 * password and saves it.
 */
export function ResetPassword() {
  const { completeEmailConfirmation, updatePassword } = useAuth();
  const navigate = useNavigate();
  const pwId = useId();
  const confirmId = useId();
  const ran = useRef(false);

  const [phase, setPhase] = useState<Phase>({ kind: "verifying" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Exchange the recovery code for a session once on mount.
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        await completeEmailConfirmation(window.location.href);
        window.history.replaceState({}, "", "/auth/reset");
        setPhase({ kind: "ready" });
      } catch (err) {
        const message =
          err instanceof AuthError
            ? err.message
            : "This reset link is invalid or has expired.";
        setPhase({ kind: "error", message });
      }
    })();
  }, [completeEmailConfirmation]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const pwErr = validatePassword(password);
    const confirmErr = validatePasswordConfirm(password, confirm);
    if (pwErr || confirmErr) {
      setErrors({ password: pwErr ?? undefined, confirm: confirmErr ?? undefined });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await updatePassword(password);
      setPhase({ kind: "saved" });
      setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : "Could not update your password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (phase.kind === "verifying") {
    return (
      <AuthShell title="Opening your reset link…">
        <div className="row" style={{ justifyContent: "center", color: "var(--text-muted)" }}>
          <span className="spinner" />
          <span>Verifying the link.</span>
        </div>
      </AuthShell>
    );
  }

  if (phase.kind === "error") {
    return (
      <AuthShell title="Reset link invalid" footer={<Link to="/forgot-password">Request a new link</Link>}>
        <div className="stack">
          <Banner variant="error">{phase.message}</Banner>
          <Link to="/forgot-password" className="btn btn-primary btn-block">
            Send a new reset link
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (phase.kind === "saved") {
    return (
      <AuthShell title="Password updated">
        <div className="stack" style={{ textAlign: "center" }}>
          <div className="row" style={{ justifyContent: "center" }}>
            <span className="check" style={{ width: 40, height: 40 }}>
              <IconCheck width={22} height={22} />
            </span>
          </div>
          <Banner variant="success">Your password is set. Taking you into AutoGPC…</Banner>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you don't use elsewhere.">
      <form className="stack" onSubmit={submit} noValidate>
        {formError && <Banner variant="error">{formError}</Banner>}

        <div className="field">
          <label htmlFor={pwId}>New password</label>
          <PasswordInput
            id={pwId}
            value={password}
            onChange={setPassword}
            invalid={!!errors.password}
            autoComplete="new-password"
            describedBy={errors.password ? `${pwId}-err` : undefined}
          />
          {errors.password && <FieldError id={`${pwId}-err`}>{errors.password}</FieldError>}
        </div>

        <div className="field">
          <label htmlFor={confirmId}>Confirm new password</label>
          <PasswordInput
            id={confirmId}
            value={confirm}
            onChange={setConfirm}
            invalid={!!errors.confirm}
            autoComplete="new-password"
            describedBy={errors.confirm ? `${confirmId}-err` : undefined}
          />
          {errors.confirm && <FieldError id={`${confirmId}-err`}>{errors.confirm}</FieldError>}
        </div>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={submitting}>
          {submitting ? <span className="spinner" /> : null}
          {submitting ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
