// App store: records + the transient review draft, persisted through the
// portable RecordStore. UI state lives here; everything it calls is engine-
// and platform-agnostic underneath.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { webStorage } from "./storage/webStorage";
import { SAMPLE_RECORDS } from "./data/sampleData";
import type {
  DocType,
  ExtractionSource,
  LineItem,
  PurchaseRecord,
} from "./core/types";

const SEEDED_FLAG = "nexus.seeded.v1";

export type ReviewDraft = {
  fields: Partial<PurchaseRecord>;
  rawText: string;
  lineItems: LineItem[];
  source: ExtractionSource;
  confidence?: number;
  imageUri: string; // preview src (object URL or data URL)
  imageBlob: Blob | null; // pending blob to persist on save
  docType: DocType;
  captureStartedAt: number;
};

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
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (!localStorage.getItem(SEEDED_FLAG)) {
        for (const r of SAMPLE_RECORDS) await webStorage.saveRecord(r);
        localStorage.setItem(SEEDED_FLAG, "1");
      }
      setRecords(await webStorage.listRecords());
      setReady(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    setRecords(await webStorage.listRecords());
  }, []);

  const addRecord = useCallback(
    async (record: PurchaseRecord, blob: Blob | null) => {
      const toSave = { ...record };
      if (blob) toSave.imageUri = await webStorage.putImage(record.id, blob);
      await webStorage.saveRecord(toSave);
      await refresh();
    },
    [refresh],
  );

  const updateRecord = useCallback(
    async (record: PurchaseRecord) => {
      await webStorage.saveRecord({ ...record, updatedAt: new Date().toISOString() });
      await refresh();
    },
    [refresh],
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      await webStorage.deleteRecord(id);
      await refresh();
    },
    [refresh],
  );

  const getRecord = useCallback((id: string) => records.find((r) => r.id === id), [records]);

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
      resolveImage: webStorage.resolveImageSrc,
    }),
    [ready, records, draft, getRecord, addRecord, updateRecord, deleteRecord],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}
