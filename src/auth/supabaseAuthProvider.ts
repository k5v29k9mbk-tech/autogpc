// Supabase implementation of the AuthProvider interface.
//
// Maps raw Supabase auth errors onto our stable AuthErrorCode taxonomy so the
// UI branches on meaning, not on backend message strings. Never logs
// credentials or tokens. Uses only the publishable key (via getSupabaseClient).

import type { Session, User, AuthError as SupabaseError } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabaseClient";
import {
  AuthError,
  type AuthProvider,
  type AuthUser,
  type OAuthProvider,
  type SignUpResult,
} from "./types";

/** Where the email-confirmation link sends the user back to. */
function emailRedirectTo(): string {
  return `${window.location.origin}/auth/callback`;
}

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    // email_confirmed_at is set once the address is confirmed.
    emailConfirmed: Boolean(user.email_confirmed_at ?? user.confirmed_at),
  };
}

/** Translate a Supabase auth error into our stable taxonomy. */
function mapError(err: SupabaseError | null, fallback: string): AuthError {
  if (!err) return new AuthError("unknown", fallback);
  const msg = err.message ?? fallback;
  const lower = msg.toLowerCase();

  // Supabase sets a machine code on most auth errors (v2). Prefer it.
  switch (err.code) {
    case "invalid_credentials":
      return new AuthError("invalid_credentials", "Email or password is incorrect.");
    case "email_not_confirmed":
      return new AuthError(
        "email_not_confirmed",
        "Your email hasn't been confirmed yet. Check your inbox for the confirmation link.",
      );
    case "user_already_exists":
    case "email_exists":
      return new AuthError("email_already_registered", "An account with this email already exists.");
    case "weak_password":
      return new AuthError("weak_password", "That password is too weak. Try a longer one.");
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return new AuthError("rate_limited", "Too many attempts. Please wait a moment and try again.");
  }

  // Fall back to message sniffing for older / un-coded errors.
  if (lower.includes("invalid login credentials"))
    return new AuthError("invalid_credentials", "Email or password is incorrect.");
  if (lower.includes("email not confirmed"))
    return new AuthError(
      "email_not_confirmed",
      "Your email hasn't been confirmed yet. Check your inbox for the confirmation link.",
    );
  if (lower.includes("already registered") || lower.includes("already been registered"))
    return new AuthError("email_already_registered", "An account with this email already exists.");
  if (err.status === 429 || lower.includes("rate limit"))
    return new AuthError("rate_limited", "Too many attempts. Please wait a moment and try again.");
  if (err.status === 0 || lower.includes("failed to fetch") || lower.includes("network"))
    return new AuthError("network", "Network error. Check your connection and try again.");

  return new AuthError("unknown", msg);
}

export const supabaseAuthProvider: AuthProvider = {
  async getSession(): Promise<AuthUser | null> {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw mapError(error, "Could not read session.");
    return toAuthUser(data.session?.user ?? null);
  },

  onAuthStateChange(handler: (user: AuthUser | null) => void): () => void {
    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, session: Session | null) => {
      handler(toAuthUser(session?.user ?? null));
    });
    return () => subscription.unsubscribe();
  },

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: emailRedirectTo() },
    });
    if (error) throw mapError(error, "Could not create your account.");

    // With email confirmation enabled, Supabase returns a user but NO session.
    // (Supabase also returns an "obfuscated" user with an empty identities array
    // when the email already exists, to avoid leaking account existence.)
    const session = data.session;
    return {
      needsEmailConfirmation: !session,
      user: toAuthUser(data.user),
    };
  },

  async signInWithPassword(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw mapError(error, "Could not sign you in.");
    const user = toAuthUser(data.user);
    if (!user) throw new AuthError("unknown", "Sign-in succeeded but no user was returned.");
    return user;
  },

  async signOut(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) throw mapError(error, "Could not sign you out.");
  },

  async resendConfirmation(email: string): Promise<void> {
    const { error } = await getSupabaseClient().auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: emailRedirectTo() },
    });
    if (error) throw mapError(error, "Could not resend the confirmation email.");
  },

  async requestPasswordReset(email: string): Promise<void> {
    // The reset link lands on /auth/reset, which exchanges the code for a
    // recovery session (via completeEmailConfirmation) and then collects the
    // new password.
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) throw mapError(error, "Could not send the reset email.");
  },

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
    if (error) throw mapError(error, "Could not update your password.");
  },

  async completeEmailConfirmation(url: string): Promise<AuthUser> {
    const parsed = new URL(url);
    const params = parsed.searchParams;

    // Supabase may redirect with an explicit error (e.g. expired link).
    const errParam = params.get("error_description") ?? params.get("error");
    if (errParam) throw new AuthError("unknown", decodeURIComponent(errParam));

    const client = getSupabaseClient();

    // PKCE flow: confirmation link returns a `code` to exchange for a session.
    const code = params.get("code");
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw mapError(error, "This confirmation link is invalid or has expired.");
      const user = toAuthUser(data.session?.user ?? null);
      if (!user) throw new AuthError("unknown", "Confirmation completed but no session was created.");
      return user;
    }

    // Alternative template style: token_hash + type, verified via verifyOtp.
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (tokenHash && type) {
      const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "signup" | "email" | "recovery" | "invite" | "email_change",
      });
      if (error) throw mapError(error, "This confirmation link is invalid or has expired.");
      const user = toAuthUser(data.session?.user ?? null);
      if (!user) throw new AuthError("unknown", "Confirmation completed but no session was created.");
      return user;
    }

    throw new AuthError("unknown", "This confirmation link is missing its token.");
  },

  // --- Seams: declared, deliberately not implemented this sprint -------------

  async signInWithOAuth(provider: OAuthProvider): Promise<void> {
    // Redirects the whole page to the provider, then back to /auth/callback with
    // a PKCE `code` that AuthCallback exchanges for a session. The redirectTo
    // must be in the Supabase dashboard's allowed Redirect URLs.
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw mapError(error, "Could not start Google sign-in.");
  },

  async signInWithCAC(): Promise<never> {
    // SEAM (b). CAC/PIV will NOT go through Supabase — it needs server-side
    // mutual TLS + DoD cert-chain validation at the proxy layer (GovCloud).
    throw new AuthError("not_implemented", "CAC / PIV sign-in isn't available yet.");
  },
};
