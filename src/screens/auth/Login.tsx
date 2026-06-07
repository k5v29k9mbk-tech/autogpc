import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, AuthError } from "../../auth";
import { validateEmail } from "../../lib/validation";
import { AuthShell, Banner, FieldError, PasswordInput, ProviderSeams } from "./authShared";

export function Login() {
  const { login, signInWithOAuth, resendConfirmation, continueAsGuest, configured } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Where to go after sign-in. Only same-app paths (leading "/") are honored, so
  // ?next can't be used as an open redirect. Used by the SSO handoff to return
  // the user to /sso/authorize.
  const nextParam = params.get("next");
  const dest = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const emailId = useId();
  const pwId = useId();
  const [googleBusy, setGoogleBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Set when the backend reports the email isn't confirmed — unlocks "resend".
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setUnconfirmed(false);

    const emailErr = validateEmail(email);
    const pwErr = password ? null : "Password is required.";
    if (emailErr || pwErr) {
      setErrors({ email: emailErr ?? undefined, password: pwErr ?? undefined });
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(dest, { replace: true });
    } catch (err) {
      const ae = err instanceof AuthError ? err : null;
      if (ae?.code === "email_not_confirmed") {
        setUnconfirmed(true);
        setFormError(ae.message);
      } else {
        setFormError(ae?.message ?? "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResendState("sending");
    try {
      await resendConfirmation(email.trim());
      setResendState("sent");
    } catch (err) {
      setResendState("idle");
      setFormError(err instanceof AuthError ? err.message : "Could not resend the email.");
    }
  };

  const goGuest = () => {
    continueAsGuest();
    navigate("/", { replace: true });
  };

  const goGoogle = async () => {
    setFormError(null);
    setGoogleBusy(true);
    try {
      // On success the page redirects to Google, so control doesn't return here.
      await signInWithOAuth("google");
    } catch (err) {
      setGoogleBusy(false);
      setFormError(err instanceof AuthError ? err.message : "Could not start Google sign-in.");
    }
  };

  return (
    <AuthShell>
      {!configured && (
        <div style={{ marginBottom: "var(--s4)" }}>
          <Banner variant="info">
            Auth isn't configured yet. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (see <code>.env.example</code>), or continue
            as a guest below.
          </Banner>
        </div>
      )}

      <form className="stack" onSubmit={submit} noValidate>
        {formError && (
          <Banner variant="error">
            {formError}
            {unconfirmed && (
              <div className="alert-action">
                {resendState === "sent" ? (
                  <span>Confirmation email sent — check your inbox.</span>
                ) : (
                  <button
                    type="button"
                    className="linkish"
                    onClick={resend}
                    disabled={resendState === "sending"}
                  >
                    {resendState === "sending" ? "Sending…" : "Resend confirmation email"}
                  </button>
                )}
              </div>
            )}
          </Banner>
        )}

        <div className="field">
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            className={`input${errors.email ? " invalid" : ""}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${emailId}-err` : undefined}
          />
          {errors.email && <FieldError id={`${emailId}-err`}>{errors.email}</FieldError>}
        </div>

        <div className="field">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <label htmlFor={pwId}>Password</label>
            <Link to="/forgot-password" className="linkish" style={{ fontSize: 13 }}>
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id={pwId}
            value={password}
            onChange={setPassword}
            invalid={!!errors.password}
            autoComplete="current-password"
            describedBy={errors.password ? `${pwId}-err` : undefined}
          />
          {errors.password && <FieldError id={`${pwId}-err`}>{errors.password}</FieldError>}
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={submitting || !configured}
        >
          {submitting ? <span className="spinner" /> : null}
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <Link to="/create-account" className="btn btn-lg btn-block">
          Create an account
        </Link>
      </form>

      <ProviderSeams onGoogle={configured ? goGoogle : undefined} busy={googleBusy} />

      <div className="auth-or">or</div>
      <button type="button" className="btn btn-ghost btn-block" onClick={goGuest}>
        Continue as guest
      </button>
      <p className="pw-hint" style={{ textAlign: "center", marginTop: "var(--s2)" }}>
        Guest mode won't save your records to an account.
      </p>
    </AuthShell>
  );
}
