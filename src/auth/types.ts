// Auth abstraction — UI-free and backend-agnostic.
//
// Mirrors the repo's existing "portable interface + web implementation" idiom
// (see src/core/storage.ts -> src/storage/webStorage.ts). The UI never imports
// a Supabase client; it talks only to this interface (via src/auth/AuthContext).
// Supabase is the current implementation (src/auth/supabaseAuthProvider.ts);
// swapping it out — or pointing it at a future GovCloud backend — means writing
// one new file that satisfies AuthProvider, with no screen changes.

/** The minimal user shape the UI needs. Provider-specific fields stay out. */
export interface AuthUser {
  id: string;
  email: string | null;
  /** True once the user has confirmed their email (signup flow gates on this). */
  emailConfirmed: boolean;
  /**
   * Display name, when known. Sourced from the provider's user metadata —
   * our own signup fields (first_name/last_name) or an OAuth provider's profile
   * (Google sends full_name / given_name / family_name). Any may be null when
   * the provider didn't supply it.
   */
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
}

/**
 * How the current visitor is using the app.
 *   - "authenticated": a real, confirmed Supabase session.
 *   - "guest":         deliberately no account and no session (data won't persist).
 *   - "anonymous":     no session and not a guest — show the gate (login/create).
 */
export type AuthMode = "authenticated" | "guest" | "anonymous";

/** Loading lifecycle for the initial session probe. */
export type AuthStatus = "loading" | "ready";

/**
 * Stable, provider-independent error codes. The Supabase implementation maps
 * raw Supabase errors onto these so screens can branch on meaning, not on
 * backend-specific message strings.
 */
export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "email_already_registered"
  | "weak_password"
  | "rate_limited"
  | "network"
  | "not_implemented"
  | "config_missing"
  | "unknown";

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

/** Result of a signup attempt. */
export interface SignUpResult {
  /**
   * When email confirmation is enabled, signup does NOT create a session — the
   * user must confirm first. `true` means "we created the account; tell them to
   * check their email". The UI must not treat signup as an immediate login.
   */
  needsEmailConfirmation: boolean;
  /** Present only if the backend returned an immediate session (confirmation off). */
  user: AuthUser | null;
}

/** Profile fields collected at signup and stored on the Supabase user. */
export interface SignUpProfile {
  firstName: string;
  lastName: string;
}

export type OAuthProvider = "google" | "apple";

/**
 * The swappable backend. Network/identity operations only — guest mode is
 * intentionally NOT here (it touches no backend; AuthContext owns it).
 */
export interface AuthProvider {
  /** Read the current persisted session, if any. */
  getSession(): Promise<AuthUser | null>;

  /**
   * Subscribe to session changes (sign-in, sign-out, token refresh). Returns an
   * unsubscribe function. AuthContext uses this to stay in sync.
   */
  onAuthStateChange(handler: (user: AuthUser | null) => void): () => void;

  signUp(email: string, password: string, profile: SignUpProfile): Promise<SignUpResult>;
  signInWithPassword(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;

  /** Re-send the confirmation email for an unconfirmed account. */
  resendConfirmation(email: string): Promise<void>;

  /**
   * Send a password-reset email. The link returns the user to the app with a
   * recovery code (completed via completeEmailConfirmation), after which
   * updatePassword sets the new password.
   */
  requestPasswordReset(email: string): Promise<void>;

  /** Set a new password for the user in the current (recovery) session. */
  updatePassword(newPassword: string): Promise<void>;

  /**
   * Complete an email-confirmation redirect: exchange the callback URL for a
   * session. Returns the confirmed user. Throws AuthError on failure.
   */
  completeEmailConfirmation(url: string): Promise<AuthUser>;

  /**
   * The current session's access token, or null when there's no live session.
   * Used by the SSO handoff (/sso/authorize) to pass a short-lived token to an
   * allow-listed partner app, which verifies it server-side. Never the refresh
   * token — partners mint their own session and must not be able to refresh ours.
   */
  getAccessToken(): Promise<string | null>;

  // --- Future-provider seams (declared, not implemented this sprint) ---------

  /**
   * "Sign in with Google / Apple". Supabase supports these natively via
   * signInWithOAuth — it redirects the page to the provider and back to
   * /auth/callback with a PKCE `code`. Enabling a provider needs its toggle in
   * the Supabase dashboard plus the callback URL in the allowed redirect URLs
   * (and, for Apple, a Services ID + key configured in the dashboard).
   */
  signInWithOAuth(provider: OAuthProvider): Promise<void>;

  /**
   * SEAM (b): CAC / PIV smart-card login. This will NOT go through Supabase —
   * it requires server-side mutual TLS + DoD cert-chain validation at the proxy
   * layer (arrives with the GovCloud backend). Placeholder only; throws
   * AuthError("not_implemented").
   */
  signInWithCAC(): Promise<never>;
}
