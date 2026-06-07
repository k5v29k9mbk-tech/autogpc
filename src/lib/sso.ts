// Allow-list for the SSO handoff (the /sso/authorize route).
//
// Nexus hands a short-lived access token back to a partner app by putting it in
// the partner's redirect_uri fragment. That makes redirect_uri a security
// boundary: if we returned a token to *any* URL, a crafted link could steal a
// signed-in user's Nexus token. So we only ever return to an origin on this
// list. Configure extra origins via VITE_SSO_ALLOWED_ORIGINS (comma-separated
// exact origins, e.g. "https://test.autogpc.com,http://localhost:3000").

/** Always-allowed partner origins, regardless of env. */
const DEFAULT_ALLOWED = ["https://test.autogpc.com"];

export function allowedOrigins(): string[] {
  const raw = (import.meta.env.VITE_SSO_ALLOWED_ORIGINS as string | undefined) ?? "";
  const fromEnv = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED, ...fromEnv]));
}

export type RedirectCheck =
  | { ok: true; origin: string; label: string }
  | { ok: false; reason: string };

/** Validate a partner's redirect_uri before we ever put a token in it. */
export function validateRedirectUri(redirectUri: string): RedirectCheck {
  if (!redirectUri)
    return { ok: false, reason: "This sign-in link is missing a return address (redirect_uri)." };

  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return { ok: false, reason: "The return address for this sign-in isn't a valid URL." };
  }

  // https only, except localhost for development.
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    return { ok: false, reason: "Sign-in can only return to a secure (https) address." };

  if (!allowedOrigins().includes(url.origin))
    return { ok: false, reason: `“${url.origin}” isn't an approved application for Nexus sign-in.` };

  return { ok: true, origin: url.origin, label: url.host };
}
