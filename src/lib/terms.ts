// Single source of truth for the Terms / liability-disclaimer version.
//
// Bump TERMS_VERSION whenever the legal text in src/screens/Terms.tsx changes
// in a way users must re-accept. signUp stamps this version + a timestamp on
// the Supabase user (user_metadata.terms_version / terms_accepted_at), which is
// the auditable record that a given account accepted these terms. The signup
// form (CreateAccount) is what actually gates on consent; the provider only
// records it, so the stamp is trustworthy only because signUp is unreachable
// until the user ticks the box.

export const TERMS_VERSION = "2026-06-30";
export const TERMS_EFFECTIVE = "June 30, 2026";
