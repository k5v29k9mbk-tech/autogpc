// Storage interface — UI-free and platform-agnostic.
//
// The web implementation (src/storage/webStorage.ts) persists the record index
// in localStorage and image blobs in IndexedDB. A future React Native shell can
// implement this same interface against AsyncStorage + the file system without
// touching any screen code.

import type { PurchaseRecord } from "./types";

/** imageUri values that begin with this prefix live in the blob store. */
export const BLOB_URI_PREFIX = "blob-store:";

export interface RecordStore {
  listRecords(): Promise<PurchaseRecord[]>;
  saveRecord(record: PurchaseRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;

  /**
   * Persist a blob under `key`; returns the URI to store (receipt image or a
   * supporting-document attachment). `key` is opaque to callers — the record id
   * for the receipt, or `<recordId>/<attachmentId>` for attachments.
   */
  putImage(key: string, blob: Blob): Promise<string>;

  /** Delete a blob previously returned by putImage. Best-effort; never throws. */
  deleteImage(uri: string): Promise<void>;

  /**
   * Turn a stored `imageUri` into something an <img> can display. Passes data:
   * and http(s) URIs through untouched; resolves blob-store URIs to an object
   * URL.
   */
  resolveImageSrc(imageUri: string): Promise<string | null>;
}
