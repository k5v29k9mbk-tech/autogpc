// Storage interface — UI-free and platform-agnostic.
//
// Two live adapters satisfy it: src/storage/webStorage.ts (localStorage +
// IndexedDB, guest mode) and src/storage/supabaseStore.ts (Postgres + Storage,
// authenticated). The CONTRACT below is what callers may rely on and what both
// adapters must uphold — it is pinned by src/storage/storage.contract.test.ts.
//
//  - listRecords returns newest-first by createdAt (ISO timestamp order).
//  - Failures reject with an `Error` carrying a human-readable message —
//    never a backend-specific shape (Supabase's PostgrestError is wrapped).
//  - deleteRecord removes the row AND its stored blobs: the receipt image
//    (keyed by the record id) and every attachment under attachmentKey().
//  - putImage keys: the record id for the receipt image, attachmentKey() for
//    supporting documents. The returned URI is adapter-specific and opaque.
//  - resolveImageSrc: data:/blob:/http(s): URIs pass through untouched; the
//    adapter's own stored URIs resolve to something an <img> can display;
//    anything else (including the OTHER adapter's URIs, e.g. a guest-mode
//    record seen while signed in) resolves to null — never a broken src.
//  - deleteImage is best-effort, never throws, and ignores foreign URIs.

import type { PurchaseRecord } from "./types";

/** imageUri values that begin with this prefix live in webStorage's blob store. */
export const BLOB_URI_PREFIX = "blob-store:";

/**
 * The blob key for a supporting-document attachment. The `<recordId>/<attId>`
 * layout is a contract: adapters use the `<recordId>/` prefix to find and
 * delete a record's attachment blobs (see deleteRecord above).
 */
export function attachmentKey(recordId: string, attachmentId: string): string {
  return `${recordId}/${attachmentId}`;
}

/** URIs an <img> can display without adapter help. */
export function isDisplayableUri(uri: string): boolean {
  return /^(data:|blob:|https?:)/.test(uri);
}

export interface RecordStore {
  listRecords(): Promise<PurchaseRecord[]>;
  saveRecord(record: PurchaseRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;

  /** Persist a blob under `key` (see key contract above); returns the URI to store. */
  putImage(key: string, blob: Blob): Promise<string>;

  /** Delete a blob previously returned by putImage. Best-effort; never throws. */
  deleteImage(uri: string): Promise<void>;

  /** Turn a stored `imageUri` into an <img>-displayable src, or null. */
  resolveImageSrc(imageUri: string): Promise<string | null>;
}
