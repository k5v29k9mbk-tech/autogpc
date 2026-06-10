// AuthContext — the single auth surface the UI consumes.
//
// It holds session + guest state and delegates all network/identity work to an
// injected AuthProvider (Supabase by default). Screens import useAuth() from
// src/auth (the barrel); they never touch the Supabase client directly, so the
// backend stays swappable.
//
// Guest mode lives here, not in the provider: it deliberately has NO backend
// session. We keep the guest flag in sessionStorage so it's ephemeral (closing
// the tab returns to the gate) — reinforcing that guest data won't persist.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabaseAuthProvider } from "./supabaseAuthProvider";
import { isSupabaseConfigured } from "./supabaseClient";
import {
  AuthError,
  type AuthMode,
  type AuthProvider,
  type AuthStatus,
  type AuthUser,
  type OAuthProvider,
  type SignUpProfile,
  type SignUpResult,
} from "./types";

const GUEST_FLAG = "nexus.guest.v1";

interface AuthContextValue {
  status: AuthStatus;
  mode: AuthMode;
  user: AuthUser | null;
  isGuest: boolean;
  /** Whether the Supabase env vars are present (UI can show a setup hint). */
  configured: boolean;

  signUp: (email: string, password: string, profile: SignUpProfile) => Promise<SignUpResult>;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
  resendConfirmation: (email: string) => Promise<void>;
  completeEmailConfirmation: (url: string) => Promise<AuthUser>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (profile: SignUpProfile) => Promise<AuthUser>;
  /** Current session access token (for the SSO handoff), or null. */
  getAccessToken: () => Promise<string | null>;

  // Seams surfaced for the UI; current provider throws not_implemented.
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProviderComponent({
  children,
  provider = supabaseAuthProvider,
}: {
  children: ReactNode;
  /** Injectable for tests / future backends. Defaults to Supabase. */
  provider?: AuthProvider;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [isGuest, setIsGuest] = useState<boolean>(
    () => sessionStorage.getItem(GUEST_FLAG) === "1",
  );
  const providerRef = useRef(provider);

  // Initial session probe + subscription. If Supabase isn't configured we skip
  // the network entirely and land in the "anonymous" gate.
  useEffect(() => {
    let active = true;
    const p = providerRef.current;

    if (!isSupabaseConfigured) {
      setStatus("ready");
      return;
    }

    (async () => {
      try {
        const current = await p.getSession();
        if (active) setUser(current);
      } catch {
        // A failed probe just means "no session"; the gate handles it.
      } finally {
        if (active) setStatus("ready");
      }
    })();

    const unsubscribe = p.onAuthStateChange((next) => {
      if (!active) return;
      setUser(next);
      // A real session supersedes guest mode.
      if (next) {
        sessionStorage.removeItem(GUEST_FLAG);
        setIsGuest(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    (email: string, password: string, profile: SignUpProfile) =>
      providerRef.current.signUp(email, password, profile),
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const u = await providerRef.current.signInWithPassword(email, password);
    sessionStorage.removeItem(GUEST_FLAG);
    setIsGuest(false);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    if (isGuest) {
      sessionStorage.removeItem(GUEST_FLAG);
      setIsGuest(false);
      return;
    }
    await providerRef.current.signOut();
    setUser(null);
  }, [isGuest]);

  const continueAsGuest = useCallback(() => {
    sessionStorage.setItem(GUEST_FLAG, "1");
    setIsGuest(true);
  }, []);

  const resendConfirmation = useCallback(
    (email: string) => providerRef.current.resendConfirmation(email),
    [],
  );

  const completeEmailConfirmation = useCallback(async (url: string) => {
    const u = await providerRef.current.completeEmailConfirmation(url);
    sessionStorage.removeItem(GUEST_FLAG);
    setIsGuest(false);
    setUser(u);
    return u;
  }, []);

  const signInWithOAuth = useCallback(
    (oauthProvider: OAuthProvider) => providerRef.current.signInWithOAuth(oauthProvider),
    [],
  );

  const requestPasswordReset = useCallback(
    (email: string) => providerRef.current.requestPasswordReset(email),
    [],
  );

  const updatePassword = useCallback(
    (newPassword: string) => providerRef.current.updatePassword(newPassword),
    [],
  );

  const updateProfile = useCallback(async (profile: SignUpProfile) => {
    const u = await providerRef.current.updateProfile(profile);
    setUser(u);
    return u;
  }, []);

  const getAccessToken = useCallback(() => providerRef.current.getAccessToken(), []);

  const mode: AuthMode = user ? "authenticated" : isGuest ? "guest" : "anonymous";

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      mode,
      user,
      isGuest,
      configured: isSupabaseConfigured,
      signUp,
      login,
      logout,
      continueAsGuest,
      resendConfirmation,
      completeEmailConfirmation,
      signInWithOAuth,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      getAccessToken,
    }),
    [
      status,
      mode,
      user,
      isGuest,
      signUp,
      login,
      logout,
      continueAsGuest,
      resendConfirmation,
      completeEmailConfirmation,
      signInWithOAuth,
      requestPasswordReset,
      updatePassword,
      updateProfile,
      getAccessToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProviderComponent>");
  return ctx;
}

export { AuthError };
