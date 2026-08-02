// Contract tests for the RecordStore seam (see core/storage.ts). The two
// adapters must uphold the same invariants; these pin the ones that had
// silently diverged: attachment cleanup on delete, foreign-URI resolution,
// and error/row mapping. webStorage runs for real against fake-indexeddb;
// supabaseStore's pure mapping half (toRow/fromRow) is tested directly.
// ponytail: the network half of supabaseStore (Postgres/Storage calls) has no
// injection point — stub the Supabase client if that ever needs pinning.

import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { emptyChecklist, emptyMandatoryAuth, type PurchaseRecord } from "../core/types";
import { attachmentKey } from "../core/storage";

function record(over: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: "r1",
    vendor: "EXCHANGE",
    transactionDate: "2026-04-22",
    totalAmount: "38.96",
    currency: "USD",
    taxAmount: null,
    cardLast4: null,
    receiptNumber: null,
    invoiceNumber: null,
    lineItems: [],
    notes: "",
    requestorName: "Jordan Reyes",
    emergencyTypeOperation: "Not in support of ETO",
    designation889: null,
    usBank: null,
    section889: null,
    mandatoryAuth: emptyMandatoryAuth(),
    attachments: [],
    rawOcrText: "",
    imageUri: "",
    status: "needs_review",
    documentChecklist: emptyChecklist(),
    source: "tesseract",
    docType: "receipt",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

// Node has no localStorage / object URLs — minimal stand-ins for the contract.
beforeAll(() => {
  const bag = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => void bag.set(k, v),
    removeItem: (k: string) => void bag.delete(k),
    get length() {
      return bag.size;
    },
    key: (i: number) => [...bag.keys()][i] ?? null,
    clear: () => bag.clear(),
  };
  let n = 0;
  URL.createObjectURL = () => `blob:fake-${n++}`;
  URL.revokeObjectURL = () => undefined;
});

describe("webStorage upholds the RecordStore contract", async () => {
  const { webStorage, clearLocalStore } = await import("./webStorage");

  beforeEach(async () => {
    await clearLocalStore();
  });

  it("lists newest-first by createdAt", async () => {
    await webStorage.saveRecord(record({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }));
    await webStorage.saveRecord(record({ id: "new", createdAt: "2026-06-01T00:00:00.000Z" }));
    const ids = (await webStorage.listRecords()).map((r) => r.id);
    expect(ids).toEqual(["new", "old"]);
  });

  it("round-trips a blob to a displayable object URL", async () => {
    const uri = await webStorage.putImage("r1", new Blob(["img"]));
    expect(uri).toMatch(/^blob-store:/);
    const src = await webStorage.resolveImageSrc(uri);
    expect(src).toMatch(/^blob:/);
    // Cached: the same URI resolves to the same object URL, not a new one.
    expect(await webStorage.resolveImageSrc(uri)).toBe(src);
  });

  it("deleteRecord removes the receipt blob AND attachment blobs", async () => {
    const receiptUri = await webStorage.putImage("r1", new Blob(["receipt"]));
    const attUri = await webStorage.putImage(attachmentKey("r1", "a1"), new Blob(["doc"]));
    await webStorage.saveRecord(record({ id: "r1", imageUri: receiptUri }));

    await webStorage.deleteRecord("r1");

    expect(await webStorage.listRecords()).toEqual([]);
    expect(await webStorage.resolveImageSrc(receiptUri)).toBeNull();
    expect(await webStorage.resolveImageSrc(attUri)).toBeNull();
  });

  it("passes displayable URIs through and resolves foreign URIs to null", async () => {
    expect(await webStorage.resolveImageSrc("data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(await webStorage.resolveImageSrc("https://x.test/a.png")).toBe("https://x.test/a.png");
    // The other adapter's scheme — unresolvable here, never a broken <img src>.
    expect(await webStorage.resolveImageSrc("receipt-store:uid/r1")).toBeNull();
  });

  it("deleteImage ignores foreign URIs without throwing", async () => {
    await expect(webStorage.deleteImage("receipt-store:uid/r1")).resolves.toBeUndefined();
    await expect(webStorage.deleteImage("data:x")).resolves.toBeUndefined();
  });
});

describe("supabaseStore row mapping upholds the contract", async () => {
  const { toRow, fromRow } = await import("./supabaseStore");

  it("round-trips a full record through toRow/fromRow", () => {
    const rec = record({ usBank: null, attachments: [] });
    expect(fromRow(toRow(rec))).toEqual(rec);
  });

  it("repairs the SQL default '{}' document_checklist into real booleans", () => {
    const row = toRow(record());
    (row as { document_checklist: unknown }).document_checklist = {};
    const rec = fromRow(row);
    expect(rec.documentChecklist).toEqual(emptyChecklist());
    expect(rec.documentChecklist.receiptUploaded).toBe(false); // not undefined
  });
});
