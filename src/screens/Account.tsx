import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, AuthError } from "../auth";
import type { AuthUser } from "../auth/types";
import { FieldError, PasswordInput } from "./auth/authShared";
import {
  passwordStrength,
  validateName,
  validatePassword,
  validatePasswordConfirm,
} from "../lib/validation";
import { IconCheck, IconLogOut, IconMail, IconShield, IconUser } from "../components/icons";

/**
 * Best-effort first/last name for pre-filling the profile inputs. Uses the
 * explicit fields when present; otherwise splits fullName ("Ada Lovelace" →
 * ["Ada", "Lovelace"]); otherwise capitalizes the email's local part so the
 * field is never blank on a fresh OAuth/legacy account.
 */
function deriveName(user: AuthUser | null): [string, string] {
  if (!user) return ["", ""];
  let first = user.firstName?.trim() ?? "";
  let last = user.lastName?.trim() ?? "";
  if (!first && !last) {
    const full = user.fullName?.trim();
    if (full) {
      const parts = full.split(/\s+/);
      first = parts[0] ?? "";
      last = parts.slice(1).join(" ");
    } else if (user.email) {
      const local = user.email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
      if (local) first = local.charAt(0).toUpperCase() + local.slice(1);
    }
  }
  return [first, last];
}

export function Account() {
  const { mode, user, requestPasswordReset, updatePassword, updateProfile, resendConfirmation, logout } =
    useAuth();
  const navigate = useNavigate();

  // --- profile (name) ---
  // Prefer the explicit first/last fields, but when they're empty (common for
  // OAuth or older accounts that only stored a full_name / email) fall back to
  // splitting fullName, then the email's local part — so the inputs arrive
  // pre-filled instead of blank.
  const [seedFirst, seedLast] = deriveName(user);
  const firstNameId = useId();
  const lastNameId = useId();
  const [firstName, setFirstName] = useState(seedFirst);
  const [lastName, setLastName] = useState(seedLast);
  const [profileState, setProfileState] = useState<"idle" | "saving" | "saved">("idle");
  const [profileErrors, setProfileErrors] = useState<{ firstName?: string; lastName?: string; form?: string }>(
    {},
  );

  // --- password (inline change) ---
  const newPwId = useId();
  const confirmPwId = useId();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwState, setPwState] = useState<"idle" | "saving" | "saved">("idle");
  const [pwErrors, setPwErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});

  // --- secondary: email a reset link ---
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent">("idle");
  const [resetError, setResetError] = useState<string | null>(null);

  // --- resend confirmation ---
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [resendError, setResendError] = useState<string | null>(null);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const profileDirty = firstName.trim() !== seedFirst || lastName.trim() !== seedLast;

  const saveProfile = async () => {
    const firstErr = validateName(firstName, "First name");
    const lastErr = validateName(lastName, "Last name");
    if (firstErr || lastErr) {
      setProfileErrors({ firstName: firstErr ?? undefined, lastName: lastErr ?? undefined });
      return;
    }
    setProfileErrors({});
    setProfileState("saving");
    try {
      await updateProfile({ firstName, lastName });
      setProfileState("saved");
    } catch (err) {
      setProfileState("idle");
      setProfileErrors({
        form: err instanceof AuthError ? err.message : "Could not update your profile.",
      });
    }
  };

  const savePassword = async () => {
    const pwErr = validatePassword(newPw);
    const confirmErr = validatePasswordConfirm(newPw, confirmPw);
    if (pwErr || confirmErr) {
      setPwErrors({ password: pwErr ?? undefined, confirm: confirmErr ?? undefined });
      return;
    }
    setPwErrors({});
    setPwState("saving");
    try {
      await updatePassword(newPw);
      setPwState("saved");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwState("idle");
      setPwErrors({ form: err instanceof AuthError ? err.message : "Could not update your password." });
    }
  };

  const emailResetLink = async () => {
    if (!user?.email) return;
    setResetError(null);
    setResetState("sending");
    try {
      await requestPasswordReset(user.email);
      setResetState("sent");
    } catch (err) {
      setResetState("idle");
      setResetError(err instanceof AuthError ? err.message : "Could not send the reset email.");
    }
  };

  const resend = async () => {
    if (!user?.email) return;
    setResendError(null);
    setResendState("sending");
    try {
      await resendConfirmation(user.email);
      setResendState("sent");
    } catch (err) {
      setResendState("idle");
      setResendError(err instanceof AuthError ? err.message : "Could not resend the confirmation email.");
    }
  };

  // Guests have no account to manage.
  if (mode !== "authenticated" || !user) {
    return (
      <div className="stack" style={{ gap: "var(--s5)" }}>
        <div className="page-head">
          <h1>Account</h1>
        </div>
        <div className="empty">
          You're browsing as a guest — no account is attached.{" "}
          <Link to="/login" style={{ color: "var(--text)" }}>
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  const strength = newPw ? passwordStrength(newPw) : null;

  return (
    <div className="stack" style={{ gap: "var(--s5)", maxWidth: 560 }}>
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>Your account</h1>
        <p className="sub">Manage your profile and how you sign in to AutoGPC.</p>
      </div>

      {/* Profile (name) */}
      <div className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title row" style={{ gap: "var(--s2)", margin: 0 }}>
          <IconUser width={15} height={15} /> Profile
        </h2>
        {profileErrors.form && (
          <div style={{ color: "var(--danger)", fontSize: 14 }}>{profileErrors.form}</div>
        )}
        <div className="field-row">
          <div className="field">
            <label htmlFor={firstNameId}>First name</label>
            <input
              id={firstNameId}
              type="text"
              className={`input${profileErrors.firstName ? " invalid" : ""}`}
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setProfileState("idle");
              }}
              autoComplete="given-name"
            />
            {profileErrors.firstName && (
              <FieldError id={`${firstNameId}-err`}>{profileErrors.firstName}</FieldError>
            )}
          </div>
          <div className="field">
            <label htmlFor={lastNameId}>Last name</label>
            <input
              id={lastNameId}
              type="text"
              className={`input${profileErrors.lastName ? " invalid" : ""}`}
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setProfileState("idle");
              }}
              autoComplete="family-name"
            />
            {profileErrors.lastName && (
              <FieldError id={`${lastNameId}-err`}>{profileErrors.lastName}</FieldError>
            )}
          </div>
        </div>
        <div className="row" style={{ gap: "var(--s3)", alignItems: "center" }}>
          <button
            className="btn"
            onClick={saveProfile}
            disabled={profileState === "saving" || !profileDirty}
          >
            {profileState === "saving" ? "Saving…" : "Save profile"}
          </button>
          {profileState === "saved" && !profileDirty && (
            <span className="row" style={{ gap: "var(--s2)", color: "var(--accent-text)", fontSize: 14 }}>
              <IconCheck width={15} height={15} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Email + status */}
      <div className="card">
        <div className="kv">
          <span className="muted row" style={{ gap: "var(--s2)" }}>
            <IconMail width={15} height={15} /> Email
          </span>
          <span>{user.email}</span>
          <span className="muted row" style={{ gap: "var(--s2)" }}>
            <IconShield width={15} height={15} /> Status
          </span>
          <span>{user.emailConfirmed ? "Email confirmed" : "Email not confirmed"}</span>
        </div>
        {!user.emailConfirmed && (
          <div style={{ marginTop: "var(--s4)" }}>
            {resendError && (
              <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: "var(--s3)" }}>
                {resendError}
              </div>
            )}
            {resendState === "sent" ? (
              <div className="row" style={{ gap: "var(--s2)", color: "var(--accent-text)", fontSize: 14 }}>
                <IconMail width={15} height={15} /> Confirmation email sent — check your inbox.
              </div>
            ) : (
              <button className="btn btn-ghost" onClick={resend} disabled={resendState === "sending"}>
                {resendState === "sending" ? "Sending…" : "Resend confirmation email"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Password */}
      <div className="card stack" style={{ gap: "var(--s4)" }}>
        <h2 className="card-title" style={{ margin: 0 }}>
          Password
        </h2>
        {pwState === "saved" ? (
          <div className="row" style={{ gap: "var(--s2)", color: "var(--accent-text)" }}>
            <IconCheck width={15} height={15} /> Password updated.
          </div>
        ) : (
          <>
            {pwErrors.form && <div style={{ color: "var(--danger)", fontSize: 14 }}>{pwErrors.form}</div>}
            <div className="field">
              <label htmlFor={newPwId}>New password</label>
              <PasswordInput
                id={newPwId}
                value={newPw}
                onChange={(v) => {
                  setNewPw(v);
                  setPwState("idle");
                }}
                invalid={!!pwErrors.password}
                autoComplete="new-password"
                describedBy={`${newPwId}-hint${pwErrors.password ? ` ${newPwId}-err` : ""}`}
              />
              {newPw && (
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
              {pwErrors.password ? (
                <FieldError id={`${newPwId}-err`}>{pwErrors.password}</FieldError>
              ) : (
                <span className="pw-hint" id={`${newPwId}-hint`}>
                  At least 8 characters, with a letter and a number.
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor={confirmPwId}>Confirm new password</label>
              <PasswordInput
                id={confirmPwId}
                value={confirmPw}
                onChange={(v) => {
                  setConfirmPw(v);
                  setPwState("idle");
                }}
                invalid={!!pwErrors.confirm}
                autoComplete="new-password"
                describedBy={pwErrors.confirm ? `${confirmPwId}-err` : undefined}
              />
              {pwErrors.confirm && <FieldError id={`${confirmPwId}-err`}>{pwErrors.confirm}</FieldError>}
            </div>
            <div>
              <button className="btn" onClick={savePassword} disabled={pwState === "saving"}>
                {pwState === "saving" ? "Updating…" : "Update password"}
              </button>
            </div>
          </>
        )}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--s4)" }}>
          {resetError && (
            <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: "var(--s3)" }}>{resetError}</div>
          )}
          {resetState === "sent" ? (
            <div className="row" style={{ gap: "var(--s2)", color: "var(--accent-text)", fontSize: 14 }}>
              <IconMail width={15} height={15} /> Reset link sent — check your inbox.
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              Prefer email?{" "}
              <button
                className="linklike"
                onClick={emailResetLink}
                disabled={resetState === "sending"}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--text)",
                  cursor: "pointer",
                  font: "inherit",
                  textDecoration: "underline",
                }}
              >
                {resetState === "sending" ? "Sending…" : "Send a reset link instead"}
              </button>
            </p>
          )}
        </div>
      </div>

      <div className="row">
        <button className="btn btn-ghost" onClick={signOut}>
          <IconLogOut width={15} height={15} /> Sign out
        </button>
      </div>
    </div>
  );
}
