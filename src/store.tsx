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
import type { RecordStore } from "./core/storage";
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

  const refresh = useCallback(async () => {
    setRecords(await storeRef.current.listRecords());
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
    }),
    [ready, records, draft, getRecord, addRecord, updateRecord, deleteRecord, resolveImage],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
