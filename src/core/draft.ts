// Record assembly — the UI-free core module that owns the staged transform
//   ExtractionResult → ReviewDraft → PurchaseRecord.
//
// DocType inference and checklist derivation used to live inside Scan and Review
// (.tsx) where they could only be exercised by rendering a screen. They are pure
// domain rules, so they belong here: one interface, one place to test, reusable
// by a future iOS shell. Screens now call draftFromResult() / recordFromDraft()
// and hold none of these rules.

import { emptyChecklist } from "./types";
import type {
  Attachment,
  DocType,
  DocumentChecklist,
  ExtractionSource,
  LineItem,
  MandatoryAuth,
  PurchaseRecord,
  RecordStatus,
} from "./types";
import { detectAuthCategories } from "./mandatoryAuth";
import type { ExtractionResult } from "./extraction/extractionService";

/**
 * The transient, in-flight capture between extraction and save: extracted
 * fields plus the pending image, inferred DocType, and capture start time.
 * Lives only in the store until the reviewer saves it.
 */
export type ReviewDraft = {
  fields: Partial<PurchaseRecord>;
  rawText: string;
  lineItems: LineItem[];
  source: ExtractionSource;
  confidence?: number;
  imageUri: string; // preview src (object URL or data URL)
  imageBlob: Blob | null; // pending blob to persist on save
  docType: DocType;
  captureStartedAt: number; // ms epoch — start of the capture timer
  /** Auto-detected mandatory-authorization seed; reviewer edits before save. */
  mandatoryAuth: MandatoryAuth;
};

/** The fields a reviewer confirms/corrects before a draft becomes a record. */
export type RecordEdits = {
  vendor: string;
  transactionDate: string;
  totalAmount: string;
  currency: string;
  taxAmount: string;
  cardLast4: string;
  receiptNumber: string;
  invoiceNumber: string;
  notes: string;
  requestorName: string;
  emergencyTypeOperation: string;
  designation889: string;
  // Required US Bank order dropdowns (see UsBankOrderFields) — flat in the form,
  // grouped into record.usBank on save.
  specialPreApproval: string;
  delegatedProcurementAuthority: string;
  prePurchaseApprovals: string;
  section508Consideration: string;
  requestToPurchaseReceived: string;
  spendAnalysis: string;
  requiredSourceScreened: string;
  finalDeliveryOutsideUs: string;
  lineItemTax: string;
  status: RecordStatus;
  docType: DocType;
  lineItems: LineItem[];
  // Mandatory-authorization detection + the supporting docs uploaded on review.
  mandatoryAuth: MandatoryAuth;
  attachments: Attachment[];
};

/**
 * Best guess at DocType from an extraction. Native-PDF text usually means a
 * vendor invoice/quote; OCR'd images are receipts; the NATO SOFA VAT-relief
 * form is recognised by its German title. Correctable on review.
 */
export function inferDocType(result: ExtractionResult): DocType {
  const t = result.rawText.toLowerCase();
  if (/abwicklungsschein|vat relief|sofa/.test(t)) return "vat_form";
  if (result.source === "pdf_text") {
    if (/invoice|rechnung/.test(t)) return "invoice";
    if (/quote|quotation|angebot/.test(t)) return "quote";
    return "invoice";
  }
  return "receipt";
}

/** Which supporting document a DocType implies is present. User-editable after. */
export function checklistForDocType(docType: DocType): DocumentChecklist {
  const c = emptyChecklist();
  if (docType === "receipt") c.receiptUploaded = true;
  else if (docType === "invoice") c.invoiceUploaded = true;
  else if (docType === "quote") c.quoteUploaded = true;
  else if (docType === "vat_form") c.approvalDocUploaded = true;
  else c.otherDocsUploaded = true;
  return c;
}

/** Wrap an ExtractionResult into a ReviewDraft, inferring DocType if not given. */
export function draftFromResult(
  result: ExtractionResult,
  opts: {
    imageUri: string;
    imageBlob: Blob | null;
    captureStartedAt: number;
    docType?: DocType;
  },
): ReviewDraft {
  const currency = (result.fields.currency ?? "").trim().toUpperCase();
  return {
    fields: result.fields,
    rawText: result.rawText,
    lineItems: result.lineItems,
    source: result.source,
    confidence: result.confidence,
    imageUri: opts.imageUri,
    imageBlob: opts.imageBlob,
    docType: opts.docType ?? inferDocType(result),
    captureStartedAt: opts.captureStartedAt,
    mandatoryAuth: {
      categories: detectAuthCategories(result.lineItems, result.rawText, result.fields.totalAmount),
      germanVendor: currency === "EUR", // VAT-relief form needed; reviewer overrides
      delivered: true,
    },
  };
}

/**
 * Assemble the final, persistable PurchaseRecord from a reviewed draft and the
 * reviewer's edits. Trims field values, derives the checklist from DocType, and
 * measures capture time from the draft's start to `finishedAt`.
 */
export function recordFromDraft(
  draft: ReviewDraft,
  edits: RecordEdits,
  ctx: { id: string; finishedAt: number; now?: string },
): PurchaseRecord {
  const captureSeconds = Math.max(0, Math.round((ctx.finishedAt - draft.captureStartedAt) / 1000));
  const now = ctx.now ?? new Date().toISOString();
  return {
    id: ctx.id,
    vendor: edits.vendor.trim(),
    transactionDate: edits.transactionDate.trim(),
    totalAmount: edits.totalAmount.trim(),
    currency: edits.currency.trim(),
    taxAmount: edits.taxAmount.trim() || null,
    cardLast4: edits.cardLast4.trim() || null,
    receiptNumber: edits.receiptNumber.trim() || null,
    invoiceNumber: edits.invoiceNumber.trim() || null,
    lineItems: edits.lineItems,
    notes: edits.notes,
    requestorName: edits.requestorName.trim(),
    // Keep ETO non-empty: blank falls back to the standard default.
    emergencyTypeOperation: edits.emergencyTypeOperation.trim() || "Not in support of ETO",
    designation889: edits.designation889.trim() || null,
    usBank: {
      specialPreApproval: edits.specialPreApproval.trim(),
      delegatedProcurementAuthority: edits.delegatedProcurementAuthority.trim(),
      prePurchaseApprovals: edits.prePurchaseApprovals.trim(),
      section508Consideration: edits.section508Consideration.trim(),
      requestToPurchaseReceived: edits.requestToPurchaseReceived.trim(),
      spendAnalysis: edits.spendAnalysis.trim(),
      requiredSourceScreened: edits.requiredSourceScreened.trim(),
      finalDeliveryOutsideUs: edits.finalDeliveryOutsideUs.trim(),
      lineItemTax: edits.lineItemTax.trim() || "0.00",
    },
    section889: null, // set later on the record detail page via the 889 lookup
    mandatoryAuth: edits.mandatoryAuth,
    attachments: edits.attachments,
    rawOcrText: draft.rawText,
    imageUri: draft.imageUri,
    status: edits.status,
    documentChecklist: checklistForDocType(edits.docType),
    captureSeconds,
    source: draft.source,
    docType: edits.docType,
    createdAt: now,
    updatedAt: now,
  };
}
