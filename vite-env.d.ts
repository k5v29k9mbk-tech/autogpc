/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase PUBLISHABLE key (sb_publishable_...). Public; safe in the bundle. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** "true" routes image receipts to the cloud OCR path (/api/extract). */
  readonly VITE_CLOUD_EXTRACTION?: string;
  // NOTE: the SECRET key is intentionally NOT declared here. It must never be a
  // VITE_* variable, or Vite would inline it into the client bundle.
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
