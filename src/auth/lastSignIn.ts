// Remembers which method the user last signed in with, so the Login screen can
// show a "last used" hint to returning users. Pure UX nicety: stored
// client-side only and never a security signal — don't gate anything on it.

export type SignInMethod = "password" | "google" | "apple";

const KEY = "nexus.lastSignIn.v1";

/** Exported for tests; validates an untrusted stored string. */
export function parseMethod(v: string | null): SignInMethod | null {
  return v === "password" || v === "google" || v === "apple" ? v : null;
}

export function rememberSignIn(method: SignInMethod): void {
  // localStorage throws in private mode / when disabled — a missing hint is fine.
  try {
    localStorage.setItem(KEY, method);
  } catch {
    /* ignore */
  }
}

export function lastSignIn(): SignInMethod | null {
  try {
    return parseMethod(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}
