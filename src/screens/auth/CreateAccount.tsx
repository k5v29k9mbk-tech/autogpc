import { useId, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, AuthError } from "../../auth";
import {
  passwordStrength,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirm,
} from "../../lib/validation";
import { IconMail } from "../../components/icons";
import { AuthShell, Banner, FieldError, PasswordInput, ProviderSeams } from "./authShared";

export function CreateAccount() {
  const { signUp, signInWithOAuth, resendConfirmation, continueAsGuest, configured } = useAuth();
  const navigate = useNavigate();
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const pwId = useId();
  const confirmId = useId();
  const [googleBusy, setGoogleBusy] = useState(false);

  const goGoogle = async () => {
    setFormError(null);
    setGoogleBusy(true);
    try {
      await signInWithOAuth("google");
    } catch (err) {
      setGoogleBusy(false);
      setFormError(err instanceof AuthError ? err.message : "Could not start Google sign-in.");
    }
  };

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Once signup succeeds with confirmation pending, we swap the form for a
  // "check your email" panel. Signup is NOT treated as a login: no session yet.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const strength = useMemo(() => passwordStrength(password), [password]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const firstNameErr = validateName(firstName, "First name");
    const lastNameErr = validateName(lastName, "Last name");
    const emailErr = validateEmail(email);
    const pwErr = validatePassword(password);
    const confirmErr = validatePasswordConfirm(password, confirm);
    if (firstNameErr || lastNameErr || emailErr || pwErr || confirmErr) {
      setErrors({
        firstName: firstNameErr ?? undefined,
        lastName: lastNameErr ?? undefined,
        email: emailErr ?? undefined,
        password: pwErr ?? undefined,
        confirm: confirmErr ?? undefined,
      });
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const result = await signUp(email.trim(), password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if (result.needsEmailConfirmation) {
        setPendingEmail(email.trim());
      } else {
        // Confirmation disabled on the project — a session already exists.
        navigate("/", { replace: true });
      }
    } catch (err) {
      const ae = err instanceof AuthError ? err : null;
      setFormError(ae?.message ?? "Could not create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!pendingEmail) return;
    setResendState("sending");
    try {
      await resendConfirmation(pendingEmail);
      setResendState("sent");
    } catch (err) {
      setResendState("idle");
      setFormError(err instanceof AuthError ? err.message : "Could not resend the email.");
    }
  };

  // --- "Check your email" state ---------------------------------------------
  if (pendingEmail) {
    return (
      <AuthShell
        title="Check your email"
        footer={
          <Link to="/login">Back to sign in</Link>
        }
      >
        <div className="stack">
          <div className="row" style={{ justifyContent: "center" }}>
            <span className="check" style={{ width: 40, height: 40 }}>
              <IconMail width={22} height={22} />
            </span>
          </div>
          <Banner variant="success">
            We sent a confirmation link to <strong>{pendingEmail}</strong>. Open it to activate your
            account, then sign in. The link opens this app and finishes setup automatically.
          </Banner>
          <p className="pw-hint" style={{ textAlign: "center" }}>
            Didn't get it? Check spam, or resend below.
          </p>
          {resendState === "sent" ? (
            <Banner variant="info">Confirmation email re-sent.</Banner>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={resend}
              disabled={resendState === "sending"}
            >
              {resendState === "sending" ? "Sending…" : "Resend confirmation email"}
            </button>
          )}
          <Link to="/login" className="btn btn-primary btn-block">
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  // --- Signup form ----------------------------------------------------------
  return (
    <AuthShell
      title="Create your account"
      subtitle="Receipt OCR for GPC cardholders."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      {!configured && (
        <div style={{ marginBottom: "var(--s4)" }}>
          <Banner variant="info">
            Auth isn't configured yet. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (see <code>.env.example</code>) to enable
            account creation.
          </Banner>
        </div>
      )}

      <form className="stack" onSubmit={submit} noValidate>
        {formError && <Banner variant="error">{formError}</Banner>}

        <div className="field-row">
          <div className="field">
            <label htmlFor={firstNameId}>First name</label>
            <input
              id={firstNameId}
              type="text"
              className={`input${errors.firstName ? " invalid" : ""}`}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              autoFocus
              aria-invalid={errors.firstName ? true : undefined}
              aria-describedby={errors.firstName ? `${firstNameId}-err` : undefined}
            />
            {errors.firstName && <FieldError id={`${firstNameId}-err`}>{errors.firstName}</FieldError>}
          </div>

          <div className="field">
            <label htmlFor={lastNameId}>Last name</label>
            <input
              id={lastNameId}
              type="text"
              className={`input${errors.lastName ? " invalid" : ""}`}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              aria-invalid={errors.lastName ? true : undefined}
              aria-describedby={errors.lastName ? `${lastNameId}-err` : undefined}
            />
            {errors.lastName && <FieldError id={`${lastNameId}-err`}>{errors.lastName}</FieldError>}
          </div>
        </div>

        <div className="field">
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            className={`input${errors.email ? " invalid" : ""}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${emailId}-err` : undefined}
          />
          {errors.email && <FieldError id={`${emailId}-err`}>{errors.email}</FieldError>}
        </div>

        <div className="field">
          <label htmlFor={pwId}>Password</label>
          <PasswordInput
            id={pwId}
            value={password}
            onChange={setPassword}
            invalid={!!errors.password}
            autoComplete="new-password"
            describedBy={`${pwId}-hint${errors.password ? ` ${pwId}-err` : ""}`}
          />
          {password && (
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
          {errors.password ? (
            <FieldError id={`${pwId}-err`}>{errors.password}</FieldError>
          ) : (
            <span className="pw-hint" id={`${pwId}-hint`}>
              At least 8 characters, with a letter and a number.
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor={confirmId}>Confirm password</label>
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

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={submitting || !configured}
        >
          {submitting ? <span className="spinner" /> : null}
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <ProviderSeams onGoogle={configured ? goGoogle : undefined} busy={googleBusy} />

      <div className="auth-or">or</div>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => {
          continueAsGuest();
          navigate("/", { replace: true });
        }}
      >
        Continue as guest
      </button>
    </AuthShell>
  );
}
