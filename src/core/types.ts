// Core domain types — UI-free and platform-agnostic on purpose.
// A future Expo / React Native shell should be able to import this file unchanged.

export type LineItem = {
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  total: string | null;
  /** SKU / product code when the document prints one (Textract PRODUCT_CODE).
   *  Optional: rows built by hand and by the regex parser don't have it. */
  productCode?: string | null;
};

export type DocumentChecklist = {
  receiptUploaded: boolean;
  invoiceUploaded: boolean;
  quoteUploaded: boolean;
  approvalDocUploaded: boolean;
  otherDocsUploaded: boolean;
};

/** The kind of supporting document an attachment is. */
export type DocCategory =
  | "receipt"
  | "purchase_request" // GPC purchase request (supervisor + RA signed)
  | "vat_form"
  | "non_receipt_memo"
  | "approval" // a mandatory-authorization approval/waiver doc
  | "other";

/**
 * A supporting document stored alongside a record (beyond the primary receipt
 * image in `imageUri`). The bytes live in the blob/Storage backend at `uri`
 * (resolved via the store's resolveImage); this is the metadata. `slotId` binds
 * it to a RequiredDoc slot (see core/mandatoryAuth) so the UI knows which
 * requirement it satisfies.
 */
export type Attachment = {
  id: string;
  slotId: string; // matches RequiredDoc.id, e.g. "vat_form" or "approval:it-computers"
  category: DocCategory;
  label: string;
  filename: string;
  contentType: string;
  uri: string;
  uploadedAt: string;
};

/**
 * Mandatory-authorization state for a record: the confirmed catalog categories
 * (auto-detected, reviewer-editable), whether the vendor is German (drives the
 * VAT-form requirement; auto-seeded from EUR), and whether the item has been
 * delivered (false drives the non-receipt-memo requirement).
 */
export type MandatoryAuth = {
  categories: string[]; // AuthCategory ids
  germanVendor: boolean;
  delivered: boolean;
};

export function emptyMandatoryAuth(): MandatoryAuth {
  return { categories: [], germanVendor: false, delivered: true };
}

export type RecordStatus =
  | "needs_review"
  | "reviewed"
  | "ready_for_entry"
  | "exported";

// pdf_text and tesseract run in-browser today. "cloud" is reserved for the
// upgrade tier — a server-side API (AWS Textract AnalyzeExpense) behind the
// same ExtractionService seam (see core/extraction/cloudExtractionService.ts).
export type ExtractionSource = "pdf_text" | "tesseract" | "cloud";

export type DocType = "receipt" | "invoice" | "quote" | "vat_form" | "other";

// Section 889 representation, mapped from the GSA SmartPay 889 tool's SAM.gov
// data. Defined here (not in lib) so a saved determination is part of the
// platform-agnostic record; the lib/section889 mapper imports these.
export type Section889Compliance = {
  isCompliant: boolean;
  statusText: string;
  farProvisionDate: string | null;
  farC1: string | null;
  farC2: string | null;
};

export type Section889Entity = {
  uei: string | null;
  cage: string | null;
  legalName: string;
  url: string | null;
  addressLines: string[];
  registrationStatus: string | null;
  activationDate: string | null;
  expirationDate: string | null;
  hasActiveExclusion: boolean;
  isSelectable: boolean;
  compliance: Section889Compliance;
};

/** A point-in-time 889 determination attached to a record (audit evidence). */
export type Saved889 = {
  entity: Section889Entity;
  checkedAt: string; // ISO timestamp of the SAM.gov lookup
};

/**
 * The "889 Designation" classification US Bank asks for on a GPC order — which
 * 889 representation pathway applies. Picked by the reviewer on the order form.
 */
export const DESIGNATION_889_OPTIONS = [
  "889 Government",
  "889 Merchant Rep",
  "889 Rebate",
] as const;

/**
 * The required US Bank "Create Order" dropdowns (red-asterisk fields) the
 * reviewer answers on top of the extracted receipt data. Grouped so they
 * persist as one JSONB column rather than a dozen scalar columns. Option
 * strings live in lib/usbankOrder. lineItemTax is the order-level "Line Item
 * Tax" amount (distinct from the per-line totals and the order Total Tax).
 */
export type UsBankOrderFields = {
  specialPreApproval: string;
  delegatedProcurementAuthority: string;
  prePurchaseApprovals: string;
  section508Consideration: string;
  requestToPurchaseReceived: string;
  spendAnalysis: string;
  requiredSourceScreened: string;
  finalDeliveryOutsideUs: string;
  lineItemTax: string;
  // The order form's address blocks. Seeded from extraction (Textract's
  // vendor-grouped address for the merchant, receiver-grouped for ship-to),
  // reviewer-editable. Optional: records saved before these existed lack them.
  merchantAddress?: string;
  merchantCity?: string;
  merchantState?: string;
  merchantPostal?: string;
  shipCity?: string;
  shipState?: string;
  shipPostal?: string;
};

/**
 * What an extractor can fill in. Mostly record fields, plus the order-form
 * fields that live in `record.usBank` — extraction reads an address off the
 * document, so it seeds those too rather than leaving them for the reviewer.
 */
export type ExtractedFields = Partial<PurchaseRecord> & Partial<UsBankOrderFields>;

export type PurchaseRecord = {
  id: string;
  vendor: string;
  transactionDate: string;
  totalAmount: string;
  currency: string;
  taxAmount: string | null;
  cardLast4: string | null;
  receiptNumber: string | null;
  invoiceNumber: string | null;
  lineItems: LineItem[];
  notes: string;
  // US Bank order fields, set on review and reused when creating the order.
  requestorName: string; // cardholder / account name; defaults to the signed-in user
  emergencyTypeOperation: string; // ETO designation; defaults to "Not in support of ETO"
  designation889: string | null; // US Bank "889 Designation" classification, picked on review
  // Required US Bank order dropdowns confirmed on review. Optional/nullable so
  // records saved before these fields existed still read back cleanly.
  usBank?: UsBankOrderFields | null;
  section889: Saved889 | null; // saved 889 determination, set on the record detail page
  // Mandatory-authorization detection + supporting documents. Optional/nullable
  // so records saved before these fields existed read back cleanly.
  mandatoryAuth?: MandatoryAuth | null;
  attachments?: Attachment[] | null;
  rawOcrText: string;
  imageUri: string;
  status: RecordStatus;
  documentChecklist: DocumentChecklist;
  source: ExtractionSource;
  docType: DocType;
  createdAt: string;
  updatedAt: string;
};

export const STATUS_ORDER: RecordStatus[] = [
  "needs_review",
  "reviewed",
  "ready_for_entry",
  "exported",
];

export const STATUS_LABELS: Record<RecordStatus, string> = {
  needs_review: "Needs review",
  reviewed: "Reviewed",
  ready_for_entry: "Ready for entry",
  exported: "Exported",
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  receipt: "Receipt",
  invoice: "Invoice",
  quote: "Quote",
  vat_form: "VAT-relief form",
  other: "Other",
};

/** DocTypes in display order (Review and RecordDetail render the same menu). */
export const DOC_TYPE_ORDER: DocType[] = ["receipt", "invoice", "quote", "vat_form", "other"];

/** Display labels for the document checklist — one owner (UI + export share it). */
export const CHECKLIST_LABELS: Record<keyof DocumentChecklist, string> = {
  receiptUploaded: "Receipt",
  invoiceUploaded: "Invoice",
  quoteUploaded: "Quote",
  approvalDocUploaded: "Approval doc",
  otherDocsUploaded: "Other",
};

export const SOURCE_LABELS: Record<ExtractionSource, string> = {
  pdf_text: "PDF text layer",
  tesseract: "On-device OCR",
  cloud: "AWS Textract",
};

export function emptyChecklist(): DocumentChecklist {
  return {
    receiptUploaded: false,
    invoiceUploaded: false,
    quoteUploaded: false,
    approvalDocUploaded: false,
    otherDocsUploaded: false,
  };
}
