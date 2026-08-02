// Web implementation of the portable RecordStore interface.
//   - record index  -> localStorage (small, synchronous, easy to inspect)
//   - image blobs    -> IndexedDB (the right home for binary data)
// Everything is local to the browser; nothing is ever uploaded.

import { BLOB_URI_PREFIX, type RecordStore } from "../core/storage";
import type { PurchaseRecord } from "../core/types";

const RECORDS_KEY = "nexus.records.v1";
const DB_NAME = "nexus";
const DB_VERSION = 1;
const IMAGE_STORE = "images";

// --- tiny IndexedDB helpers -------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbPut(key: string, value: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    tx.objectStore(IMAGE_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readonly");
    const req = tx.objectStore(IMAGE_STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    tx.objectStore(IMAGE_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- record index -----------------------------------------------------------

function readIndex(): PurchaseRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PurchaseRecord[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(records: PurchaseRecord[]): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

// Object-URL cache so the same blob isn't re-materialized on every render.
const objectUrlCache = new Map<string, string>();

/**
 * Wipe every local record AND its stored blobs. Clearing only the localStorage
 * index would leave the receipt images orphaned in IndexedDB — invisible, but
 * still on the device, which is not what "clear my data" means.
 */
export async function clearLocalStore(): Promise<void> {
  try {
    localStorage.removeItem(RECORDS_KEY);
  } catch {
    /* ignore */
  }
  for (const url of objectUrlCache.values()) URL.revokeObjectURL(url);
  objectUrlCache.clear();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, "readwrite");
      tx.objectStore(IMAGE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export const webStorage: RecordStore = {
  async listRecords() {
    return readIndex().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async saveRecord(record) {
    const records = readIndex();
    const idx = records.findIndex((r) => r.id === record.id);
    if (idx >= 0) records[idx] = record;
    else records.push(record);
    writeIndex(records);
  },

  async deleteRecord(id) {
    writeIndex(readIndex().filter((r) => r.id !== id));
    const key = BLOB_URI_PREFIX + id;
    const cached = objectUrlCache.get(key);
    if (cached) {
      URL.revokeObjectURL(cached);
      objectUrlCache.delete(key);
    }
    await idbDelete(id).catch(() => undefined);
  },

  async putImage(key, blob) {
    await idbPut(key, blob);
    return BLOB_URI_PREFIX + key;
  },

  async deleteImage(uri) {
    if (!uri.startsWith(BLOB_URI_PREFIX)) return; // data:/http: — nothing local to drop
    const key = uri.slice(BLOB_URI_PREFIX.length);
    const cached = objectUrlCache.get(uri);
    if (cached) {
      URL.revokeObjectURL(cached);
      objectUrlCache.delete(uri);
    }
    await idbDelete(key).catch(() => undefined);
  },

  async resolveImageSrc(imageUri) {
    if (!imageUri) return null;
    if (!imageUri.startsWith(BLOB_URI_PREFIX)) return imageUri; // data: / http(s):
    if (objectUrlCache.has(imageUri)) return objectUrlCache.get(imageUri)!;
    const id = imageUri.slice(BLOB_URI_PREFIX.length);
    const blob = await idbGet(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(imageUri, url);
    return url;
  },
};
