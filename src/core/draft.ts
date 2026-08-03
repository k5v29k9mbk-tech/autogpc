// Record assembly — the UI-free core module that owns the staged transform
//   ExtractionResult → ReviewDraft → RecordEdits → PurchaseRecord.
//
// The domain rules for that transform live here, not in screens: DocType
// inference, checklist derivation, the seed defaults a reviewer starts from
// (seedEdits), and the required-field policy that blocks a save
// (missingRequired). Review renders the form; this module decides its contents.

import { emptyChecklist, emptyMandatoryAuth } from "./types";
import type {
  Attachment,
  DocType,
  ExtractedFields,
  DocumentChecklist,
  ExtractionSource,
  LineItem,
  MandatoryAuth,
  PurchaseRecord,
  RecordStatus,
  Saved889,
} from "./types";
import { detectAuthCategories, suggestSpecialPreApproval } from "./mandatoryAuth";
import { detectKnownVendor } from "./knownVendors";
import { toIsoDate } from "./dates";
// ponytail: core importing lib mirrors extractionRouter -> lib/pdfThumbnail;
// the US Bank option vocabularies have one owner (lib/usbankOrder) and seeding
// needs them. Move the vocabularies into core/ if the layering ever firms up.
import {
  DEFAULT_ETO,
  DELEGATED_PROCUREMENT_AUTHORITY_OPTIONS,
  finalDeliveryDefault,
  PREPURCHASE_APPROVALS_OPTIONS,
  REQUEST_TO_PURCHASE_OPTIONS,
  SECTION_508_OPTIONS,
  SPECIAL_PRE_APPROVAL_OPTIONS,
} from "../lib/usbankOrder";
import type { ExtractionResult } from "./extraction/extractionService";

/**
 * The transient, in-flight capture between extraction and save: extracted
 * fields plus the pending image and inferred DocType.
 * Lives only in the store until the reviewer saves it.
 */
export type ReviewDraft = {
  fields: ExtractedFields;
  rawText: string;
  lineItems: LineItem[];
  source: ExtractionSource;
  confidence?: number;
  imageUri: string; // preview src (object URL or data URL)
  imageBlob: Blob | null; // pending blob to persist on save
  docType: DocType;
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
  // Address blocks, seeded from extraction (see ExtractedFields).
  merchantAddress: string;
  merchantCity: string;
  merchantState: string;
  merchantPostal: string;
  shipCity: string;
  shipState: string;
  shipPostal: string;
  status: RecordStatus;
  docType: DocType;
  lineItems: LineItem[];
  // Mandatory-authorization detection + the supporting docs uploaded on review.
  mandatoryAuth: MandatoryAuth;
  attachments: Attachment[];
  /** SAM.gov 889 determination confirmed during review (null until looked up). */
  section889: Saved889 | null;
};

/** What seeding needs to know about the signed-in user. Structural, so core
 *  doesn't depend on the auth module's AuthUser type. */
export type SeedUser = {
  /** Cardholder display name — receipts don't carry the requestor. */
  cardholderName?: string;
  /** Duty-station OCONUS flag; seeds "Final Delivery Outside US?". */
  dutyStationOconus?: boolean | null;
};

/**
 * The form state a reviewer starts from: extracted fields normalized for the
 * form controls, plus every default the app can responsibly pre-answer. The
 * rules, in one place:
 *  - dates normalize to ISO for the date picker, falling back to today;
 *  - currency defaults to USD (the GPC default), tax fields to "0.00";
 *  - requestor defaults to the signed-in cardholder;
 *  - known intragovernmental vendors (e.g. AAFES Exchange) seed "889 Government";
 *  - each required US Bank dropdown seeds its standard GPC answer — except
 *    Spend Analysis and Required Source (item-dependent, reviewer must pick),
 *    and Special Pre-Approval, which seeds from detected auth categories;
 *  - Final Delivery seeds from the duty station (CONUS "No", OCONUS APO/FPO).
 */
export function seedEdits(draft: ReviewDraft | null, user: SeedUser = {}): RecordEdits {
  const f = draft?.fields ?? {};
  return {
    vendor: f.vendor ?? "",
    // en-CA renders local time as YYYY-MM-DD (not UTC like toISOString).
    transactionDate: toIsoDate(f.transactionDate) ?? new Date().toLocaleDateString("en-CA"),
    totalAmount: f.totalAmount ?? "",
    currency: f.currency || "USD",
    taxAmount: f.taxAmount || "0.00",
    cardLast4: f.cardLast4 ?? "",
    receiptNumber: f.receiptNumber ?? "",
    invoiceNumber: f.invoiceNumber ?? "",
    notes: f.notes ?? "",
    requestorName: user.cardholderName ?? "",
    emergencyTypeOperation: DEFAULT_ETO,
    designation889: detectKnownVendor(draft?.rawText ?? "")?.designation889 ?? "",
    specialPreApproval:
      suggestSpecialPreApproval(draft?.mandatoryAuth?.categories ?? []) ||
      SPECIAL_PRE_APPROVAL_OPTIONS[0],
    delegatedProcurementAuthority: DELEGATED_PROCUREMENT_AUTHORITY_OPTIONS[0],
    prePurchaseApprovals: PREPURCHASE_APPROVALS_OPTIONS[0],
    section508Consideration: SECTION_508_OPTIONS[0],
    requestToPurchaseReceived: REQUEST_TO_PURCHASE_OPTIONS[0],
    spendAnalysis: "",
    requiredSourceScreened: "",
    finalDeliveryOutsideUs: finalDeliveryDefault(user.dutyStationOconus),
    lineItemTax: "0.00",
    merchantAddress: f.merchantAddress ?? "",
    merchantCity: f.merchantCity ?? "",
    merchantState: f.merchantState ?? "",
    merchantPostal: f.merchantPostal ?? "",
    shipCity: f.shipCity ?? "",
    shipState: f.shipState ?? "",
    shipPostal: f.shipPostal ?? "",
    status: "needs_review",
    docType: draft?.docType ?? "receipt",
    lineItems: draft?.lineItems ?? [],
    mandatoryAuth: draft?.mandatoryAuth ?? emptyMandatoryAuth(),
    attachments: [],
    section889: null,
  };
}

/** Every red-asterisk US Bank Create-Order field, with its form label. */
const REQUIRED_FIELDS: [keyof RecordEdits & string, string][] = [
  ["requestorName", "Requestor name"],
  ["totalAmount", "Amount"],
  ["transactionDate", "Order date"],
  ["specialPreApproval", "Special Pre-Approval Obtained"],
  ["delegatedProcurementAuthority", "Delegated Procurement Authority Used"],
  ["prePurchaseApprovals", "A/BO and/or RM/FM Pre-Purch Approvals Obtained"],
  ["section508Consideration", "Items Subject to Section 508 Consideration"],
  ["requestToPurchaseReceived", "Request to Purchase Received"],
  ["spendAnalysis", "Spend Analysis"],
  ["vendor", "Merchant name"],
  ["requiredSourceScreened", "Required Source Screened"],
  ["designation889", "889 Designation"],
  ["finalDeliveryOutsideUs", "Final Delivery Location Outside United States"],
];

/**
 * US Bank requires every red-asterisk field before an order can be created;
 * the same policy blocks a save here so a saved record is order-ready, not
 * half-filled. Returns the labels of what's missing (empty = save allowed).
 */
export function missingRequired(edits: RecordEdits): string[] {
  const gaps = REQUIRED_FIELDS.filter(([key]) => !String(edits[key]).trim()).map(
    ([, label]) => label,
  );
  // Line items are optional, but any present one needs a description and total.
  if (edits.lineItems.some((li) => !li.description.trim() || !String(li.total ?? "").trim()))
    gaps.push("Line item description and total");
  return gaps;
}

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
    mandatoryAuth: {
      categories: detectAuthCategories(result.lineItems, result.rawText, result.fields.totalAmount),
      germanVendor: currency === "EUR", // VAT-relief form needed; reviewer overrides
      delivered: true,
    },
  };
}

/**
 * Assemble the final, persistable PurchaseRecord from a reviewed draft and the
 * reviewer's edits. Trims field values and derives the checklist from DocType.
 */
export function recordFromDraft(
  draft: ReviewDraft,
  edits: RecordEdits,
  ctx: { id: string; now?: string },
): PurchaseRecord {
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
      merchantAddress: edits.merchantAddress.trim(),
      merchantCity: edits.merchantCity.trim(),
      merchantState: edits.merchantState.trim(),
      merchantPostal: edits.merchantPostal.trim(),
      shipCity: edits.shipCity.trim(),
      shipState: edits.shipState.trim(),
      shipPostal: edits.shipPostal.trim(),
    },
    section889: edits.section889,
    mandatoryAuth: edits.mandatoryAuth,
    attachments: edits.attachments,
    rawOcrText: draft.rawText,
    imageUri: draft.imageUri,
    status: edits.status,
    documentChecklist: checklistForDocType(edits.docType),
    source: draft.source,
    docType: edits.docType,
    createdAt: now,
    updatedAt: now,
  };
}
