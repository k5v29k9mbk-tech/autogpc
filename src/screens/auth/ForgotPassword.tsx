import { useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, AuthError } from "../../auth";
import { validateEmail } from "../../lib/validation";
import { AuthShell, Banner, FieldError } from "./authShared";

export function ForgotPassword() {
  const { requestPasswordReset, configured } = useAuth();
  const emailId = useId();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : "Could not send the reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" footer={<Link to="/login">Back to sign in</Link>}>
        <Banner variant="success">
          If an account exists for <strong>{email.trim()}</strong>, we've sent a link to reset your
          password. The link opens this app and lets you set a new one.
        </Banner>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new password."
      footer={<Link to="/login">Back to sign in</Link>}
    >
      {!configured && (
        <div style={{ marginBottom: "var(--s4)" }}>
          <Banner variant="info">
            Auth isn't configured yet. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (see <code>.env.example</code>).
          </Banner>
        </div>
      )}

      <form className="stack" onSubmit={submit} noValidate>
        {formError && <Banner variant="error">{formError}</Banner>}

        <div className="field">
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            className={`input${error ? " invalid" : ""}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${emailId}-err` : undefined}
          />
          {error && <FieldError id={`${emailId}-err`}>{error}</FieldError>}
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={submitting || !configured}
        >
          {submitting ? <span className="spinner" /> : null}
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
