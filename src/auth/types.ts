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

export type OAuthProvider = "google";

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

  signUp(email: string, password: string): Promise<SignUpResult>;
  signInWithPassword(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;

  /** Re-send the confirmation email for an unconfirmed account. */
  resendConfirmation(email: string): Promise<void>;

  /**
   * Complete an email-confirmation redirect: exchange the callback URL for a
   * session. Returns the confirmed user. Throws AuthError on failure.
   */
  completeEmailConfirmation(url: string): Promise<AuthUser>;

  // --- Future-provider seams (declared, not implemented this sprint) ---------

  /**
   * SEAM (a): "Sign in with Google". Supabase supports this natively via
   * signInWithOAuth. NOT implemented this sprint — the current implementation
   * throws AuthError("not_implemented"). When enabled, it hooks in here plus a
   * Google provider toggle in the Supabase dashboard and an entry in the
   * callback's allowed redirect URLs.
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
