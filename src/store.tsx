// App store: records + the transient review draft, persisted through the
// portable RecordStore. The active store depends on who's using the app:
//   - authenticated -> supabaseStore (Postgres + Storage, per-user via RLS)
//   - guest / gate  -> webStorage    (this browser only, never uploaded)
// Records re-load whenever the session changes, so signing in surfaces the
// account's cloud records and signing out drops back to local.

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
import { useAuth } from "./auth";
import { webStorage } from "./storage/webStorage";
import { supabaseStore } from "./storage/supabaseStore";
import { attachmentKey, type RecordStore } from "./core/storage";
import type { ReviewDraft } from "./core/draft";
import type { PurchaseRecord } from "./core/types";

// ReviewDraft now lives with the rest of the record-assembly logic in core/.
export type { ReviewDraft } from "./core/draft";

interface StoreValue {
  ready: boolean;
  records: PurchaseRecord[];
  draft: ReviewDraft | null;
  setDraft: (d: ReviewDraft | null) => void;
  getRecord: (id: string) => PurchaseRecord | undefined;
  addRecord: (record: PurchaseRecord, blob: Blob | null) => Promise<void>;
  updateRecord: (record: PurchaseRecord) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  resolveImage: (uri: string) => Promise<string | null>;
  /** Persist a supporting-document file; returns the stored blob metadata. */
  putAttachment: (
    recordId: string,
    file: File,
  ) => Promise<{ id: string; uri: string; filename: string; contentType: string }>;
  /** Drop a previously stored attachment blob (best-effort). */
  deleteAttachment: (uri: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { status, mode, user } = useAuth();
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [ready, setReady] = useState(false);

  // Pick the backend by session. Held in a ref so the callbacks below always
  // reach the current store without changing identity on every render.
  const store: RecordStore = mode === "authenticated" ? supabaseStore : webStorage;
  const storeRef = useRef(store);
  storeRef.current = store;

  // Never let a failed refetch reject the mutation that triggered it — the
  // save/delete already succeeded, and surfacing this as "Could not save" is a
  // false negative on the user's data. The list just goes stale until the next
  // successful refresh.
  const refresh = useCallback(async () => {
    try {
      setRecords(await storeRef.current.listRecords());
    } catch (err) {
      console.warn("[store] could not refresh records:", err);
    }
  }, []);

  // (Re)load whenever auth settles or the active user changes.
  useEffect(() => {
    if (status !== "ready") return;
    let active = true;
    setReady(false);
    (async () => {
      try {
        const recs = await storeRef.current.listRecords();
        if (active) setRecords(recs);
      } catch (err) {
        console.warn("[store] could not load records:", err);
        if (active) setRecords([]);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [status, mode, user?.id]);

  const addRecord = useCallback(
    async (record: PurchaseRecord, blob: Blob | null) => {
      const toSave = { ...record };
      if (blob) toSave.imageUri = await storeRef.current.putImage(record.id, blob);
      await storeRef.current.saveRecord(toSave);
      await refresh();
    },
    [refresh],
  );

  const updateRecord = useCallback(
    async (record: PurchaseRecord) => {
      await storeRef.current.saveRecord({ ...record, updatedAt: new Date().toISOString() });
      await refresh();
    },
    [refresh],
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      await storeRef.current.deleteRecord(id);
      await refresh();
    },
    [refresh],
  );

  const getRecord = useCallback((id: string) => records.find((r) => r.id === id), [records]);

  const resolveImage = useCallback((uri: string) => storeRef.current.resolveImageSrc(uri), []);

  const putAttachment = useCallback(async (recordId: string, file: File) => {
    const id = newId();
    const uri = await storeRef.current.putImage(attachmentKey(recordId, id), file);
    return { id, uri, filename: file.name, contentType: file.type || "application/octet-stream" };
  }, []);

  const deleteAttachment = useCallback((uri: string) => storeRef.current.deleteImage(uri), []);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      records,
      draft,
      setDraft,
      getRecord,
      addRecord,
      updateRecord,
      deleteRecord,
      resolveImage,
      putAttachment,
      deleteAttachment,
    }),
    [ready, records, draft, getRecord, addRecord, updateRecord, deleteRecord, resolveImage, putAttachment, deleteAttachment],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
