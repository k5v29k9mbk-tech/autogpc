// The one place a Supabase client is created. Nothing else in the app imports
// @supabase/supabase-js directly — screens go through src/auth/AuthContext,
// which talks to the AuthProvider interface.
//
// KEYS: client-side code may only ever use the PUBLISHABLE key
// (sb_publishable_...). It is designed to be public and is safe in the browser
// bundle. The SECRET key (sb_secret_...) must NEVER appear here, in any VITE_*
// variable, in a URL, or in a log — Vite inlines every VITE_* value into the
// shipped bundle. The secret key has no home in this static SPA; it belongs to
// the future server/GovCloud backend only. See .env.example.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AuthError } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * True when both required public env vars are present. Screens can show a calm
 * "auth isn't configured yet" message instead of crashing during local setup.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey);

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new AuthError(
      "config_missing",
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        // PKCE is the recommended browser flow; the email-confirmation link
        // returns a `code` we exchange explicitly in the callback route.
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        // We handle the callback URL ourselves (AuthCallback screen) so we can
        // show clear success/error states, rather than letting the client
        // silently consume tokens on any page load.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
