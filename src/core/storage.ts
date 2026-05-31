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
  getRecord(id: string): Promise<PurchaseRecord | null>;
  saveRecord(record: PurchaseRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;

  /** Persist an image blob; returns the `imageUri` to store on the record. */
  putImage(id: string, blob: Blob): Promise<string>;

  /**
   * Turn a stored `imageUri` into something an <img> can display. Passes data:
   * and http(s) URIs through untouched; resolves blob-store URIs to an object
   * URL.
   */
  resolveImageSrc(imageUri: string): Promise<string | null>;
}
