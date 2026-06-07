// Client-side auth field validation. Inline, synchronous, no dependencies.
// Server/Supabase remains the source of truth (and RLS guards data) — these
// rules just give fast, friendly feedback before submit.

/** Pragmatic email shape check. Not RFC-perfect by design — Supabase verifies. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase's default minimum. Mirror it client-side so we fail fast. */
export const MIN_PASSWORD_LENGTH = 8;

export function validateName(value: string, label: string): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (v.length > 60) return `${label} is too long.`;
  return null;
}

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return "Email is required.";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Password is required.";
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  // Basic strength: not all one character class.
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  if (!hasLetter || !hasNumber)
    return "Include at least one letter and one number.";
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) return "Re-enter your password.";
  if (password !== confirm) return "Passwords don't match.";
  return null;
}

export type PasswordStrength = "weak" | "fair" | "strong";

/** Lightweight strength signal for the meter — advisory only. */
export function passwordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 2) return "weak";
  if (score <= 3) return "fair";
  return "strong";
}
