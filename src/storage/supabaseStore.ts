// Supabase implementation of the portable RecordStore interface.
//   - record rows  -> Postgres table `public.records` (Row-Level Security)
//   - image blobs  -> private Storage bucket `receipts`, at "<user_id>/<id>"
// Used for authenticated sessions; guest mode stays on webStorage (local only).
// Scoping is enforced by RLS (auth.uid() from the session JWT), not by the
// client — see supabase/migrations/0001_records.sql.

import { getSupabaseClient } from "../auth/supabaseClient";
import { isDisplayableUri, type RecordStore } from "../core/storage";
import { emptyChecklist } from "../core/types";
import type {
  Attachment,
  DocType,
  DocumentChecklist,
  ExtractionSource,
  LineItem,
  MandatoryAuth,
  PurchaseRecord,
  RecordStatus,
  Saved889,
  UsBankOrderFields,
} from "../core/types";

const TABLE = "records";
const BUCKET = "receipts";
/** image_uri values stored in the Storage bucket carry this prefix. */
const STORAGE_URI_PREFIX = "receipt-store:";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

/**
 * The contract (core/storage.ts) says failures are Errors with readable
 * messages — Supabase rejects with plain PostgrestError/StorageError objects,
 * which fail `instanceof Error` checks in every caller. Wrap once, here.
 */
function asError(e: unknown, fallback: string): Error {
  if (e instanceof Error) return e;
  const msg = (e as { message?: string })?.message;
  return new Error(msg || fallback);
}

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
  designation_889: string | null;
  us_bank_fields: UsBankOrderFields | null;
  section_889: Saved889 | null;
  mandatory_auth: MandatoryAuth | null;
  attachments: Attachment[] | null;
  raw_ocr_text: string;
  image_uri: string;
  status: RecordStatus;
  document_checklist: DocumentChecklist;
  source: ExtractionSource;
  doc_type: DocType;
  created_at: string;
  updated_at: string;
};

/** PurchaseRecord -> row. user_id is omitted: it defaults to auth.uid() on insert.
 *  Exported (with fromRow) so the pure mapping half is unit-testable. */
export function toRow(r: PurchaseRecord): Row {
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
    designation_889: r.designation889,
    us_bank_fields: r.usBank ?? null,
    section_889: r.section889,
    mandatory_auth: r.mandatoryAuth ?? null,
    attachments: r.attachments ?? null,
    raw_ocr_text: r.rawOcrText,
    image_uri: r.imageUri,
    status: r.status,
    document_checklist: r.documentChecklist,
    source: r.source,
    doc_type: r.docType,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export function fromRow(row: Row): PurchaseRecord {
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
    designation889: row.designation_889 ?? null,
    usBank: row.us_bank_fields ?? null,
    section889: row.section_889 ?? null,
    mandatoryAuth: row.mandatory_auth ?? null,
    attachments: row.attachments ?? null,
    rawOcrText: row.raw_ocr_text,
    imageUri: row.image_uri,
    status: row.status,
    // The column's SQL default is '{}' (0001_records.sql), which satisfies the
    // type only after this merge — otherwise every flag reads undefined.
    documentChecklist: { ...emptyChecklist(), ...(row.document_checklist ?? {}) },
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

// Signed URLs cost a network round-trip each, so every <img> mount used to
// re-fetch one. Cache them for most of their lifetime; refresh before expiry.
// ponytail: unbounded Map — fine for one user's records; add eviction if a
// session ever holds thousands of images.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_REUSE_MS = (SIGNED_URL_TTL - 10 * 60) * 1000; // reuse for 50 min

export const supabaseStore: RecordStore = {
  async listRecords() {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw asError(error, "Could not load records.");
    return ((data ?? []) as Row[]).map(fromRow);
  },

  async saveRecord(record) {
    const { error } = await getSupabaseClient().from(TABLE).upsert(toRow(record));
    if (error) throw asError(error, "Could not save the record.");
  },

  async deleteRecord(id) {
    const client = getSupabaseClient();
    // Best-effort image cleanup first; never block the row delete on it. Remove
    // the receipt file (<uid>/<id>) plus any attachment blobs in its folder
    // (<uid>/<id>/<attachmentId>).
    try {
      const uid = await currentUserId();
      const paths = [`${uid}/${id}`];
      const { data: children } = await client.storage.from(BUCKET).list(`${uid}/${id}`);
      for (const obj of children ?? []) paths.push(`${uid}/${id}/${obj.name}`);
      await client.storage.from(BUCKET).remove(paths);
    } catch {
      /* images may not exist; ignore */
    }
    const { error } = await client.from(TABLE).delete().eq("id", id);
    if (error) throw asError(error, "Could not delete the record.");
  },

  async putImage(key, blob) {
    const uid = await currentUserId();
    const path = `${uid}/${key}`;
    const { error } = await getSupabaseClient()
      .storage.from(BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (error) throw asError(error, "Could not upload the file.");
    return STORAGE_URI_PREFIX + path;
  },

  async deleteImage(uri) {
    if (!uri.startsWith(STORAGE_URI_PREFIX)) return; // data:/http: — not ours
    const path = uri.slice(STORAGE_URI_PREFIX.length);
    try {
      await getSupabaseClient().storage.from(BUCKET).remove([path]);
    } catch {
      /* best-effort */
    }
  },

  async resolveImageSrc(imageUri) {
    if (!imageUri) return null;
    if (!imageUri.startsWith(STORAGE_URI_PREFIX)) {
      // data:/blob:/http(s): pass through; a foreign store's URI (e.g. a local
      // guest record's "blob-store:" key) is unresolvable here — null, not a
      // broken <img src>.
      return isDisplayableUri(imageUri) ? imageUri : null;
    }
    const cached = signedUrlCache.get(imageUri);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const path = imageUri.slice(STORAGE_URI_PREFIX.length);
    const { data, error } = await getSupabaseClient()
      .storage.from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (error) return null;
    signedUrlCache.set(imageUri, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_REUSE_MS });
    return data.signedUrl;
  },
};
