// Supabase implementation of the portable RecordStore interface.
//   - record rows  -> Postgres table `public.records` (Row-Level Security)
//   - image blobs  -> private Storage bucket `receipts`, at "<user_id>/<id>"
// Used for authenticated sessions; guest mode stays on webStorage (local only).
// Scoping is enforced by RLS (auth.uid() from the session JWT), not by the
// client — see supabase/migrations/0001_records.sql.

import { getSupabaseClient } from "../auth/supabaseClient";
import type { RecordStore } from "../core/storage";
import type {
  DocType,
  DocumentChecklist,
  ExtractionSource,
  LineItem,
  PurchaseRecord,
  RecordStatus,
} from "../core/types";

const TABLE = "records";
const BUCKET = "receipts";
/** image_uri values stored in the Storage bucket carry this prefix. */
const STORAGE_URI_PREFIX = "receipt-store:";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

/** Snake_case row shape as it lives in Postgres. */
type Row = {
  id: string;
  vendor: string;
  transaction_date: string;
  total_amount: string;
  currency: string;
  tax_amount: string | null;
  card_last4: string | null;
  receipt_number: string | null;
  invoice_number: string | null;
  line_items: LineItem[];
  notes: string;
  requestor_name: string;
  emergency_type_operation: string;
  raw_ocr_text: string;
  image_uri: string;
  status: RecordStatus;
  document_checklist: DocumentChecklist;
  capture_seconds: number | null;
  source: ExtractionSource;
  doc_type: DocType;
  created_at: string;
  updated_at: string;
};

/** PurchaseRecord -> row. user_id is omitted: it defaults to auth.uid() on insert. */
function toRow(r: PurchaseRecord): Row {
  return {
    id: r.id,
    vendor: r.vendor,
    transaction_date: r.transactionDate,
    total_amount: r.totalAmount,
    currency: r.currency,
    tax_amount: r.taxAmount,
    card_last4: r.cardLast4,
    receipt_number: r.receiptNumber,
    invoice_number: r.invoiceNumber,
    line_items: r.lineItems,
    notes: r.notes,
    requestor_name: r.requestorName,
    emergency_type_operation: r.emergencyTypeOperation,
    raw_ocr_text: r.rawOcrText,
    image_uri: r.imageUri,
    status: r.status,
    document_checklist: r.documentChecklist,
    capture_seconds: r.captureSeconds,
    source: r.source,
    doc_type: r.docType,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function fromRow(row: Row): PurchaseRecord {
  return {
    id: row.id,
    vendor: row.vendor,
    transactionDate: row.transaction_date,
    totalAmount: row.total_amount,
    currency: row.currency,
    taxAmount: row.tax_amount,
    cardLast4: row.card_last4,
    receiptNumber: row.receipt_number,
    invoiceNumber: row.invoice_number,
    lineItems: row.line_items ?? [],
    notes: row.notes,
    requestorName: row.requestor_name ?? "",
    emergencyTypeOperation: row.emergency_type_operation ?? "Not in support of ETO",
    rawOcrText: row.raw_ocr_text,
    imageUri: row.image_uri,
    status: row.status,
    documentChecklist: row.document_checklist,
    captureSeconds: row.capture_seconds,
    source: row.source,
    docType: row.doc_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function currentUserId(): Promise<string> {
  const { data } = await getSupabaseClient().auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error("Not signed in — cannot access cloud records.");
  return id;
}

export const supabaseStore: RecordStore = {
  async listRecords() {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Row[]).map(fromRow);
  },

  async saveRecord(record) {
    const { error } = await getSupabaseClient().from(TABLE).upsert(toRow(record));
    if (error) throw error;
  },

  async deleteRecord(id) {
    const client = getSupabaseClient();
    // Best-effort image cleanup first; never block the row delete on it.
    try {
      const uid = await currentUserId();
      await client.storage.from(BUCKET).remove([`${uid}/${id}`]);
    } catch {
      /* image may not exist; ignore */
    }
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },

  async putImage(id, blob) {
    const uid = await currentUserId();
    const path = `${uid}/${id}`;
    const { error } = await getSupabaseClient()
      .storage.from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (error) throw error;
    return STORAGE_URI_PREFIX + path;
  },

  async resolveImageSrc(imageUri) {
    if (!imageUri) return null;
    if (!imageUri.startsWith(STORAGE_URI_PREFIX)) return imageUri; // data: / http(s):
    const path = imageUri.slice(STORAGE_URI_PREFIX.length);
    const { data, error } = await getSupabaseClient()
      .storage.from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error) return null;
    return data.signedUrl;
  },
};
