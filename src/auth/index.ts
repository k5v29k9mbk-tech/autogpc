// Public auth barrel. The rest of the app imports ONLY from here — never from
// supabaseClient / supabaseAuthProvider — so the Supabase backend stays
// swappable behind the AuthProvider interface.

export { AuthProviderComponent, useAuth } from "./AuthContext";
export { AuthError, displayName } from "./types";
export type {
  AuthUser,
  AuthMode,
  AuthStatus,
  AuthErrorCode,
  SignUpResult,
  OAuthProvider,
} from "./types";
