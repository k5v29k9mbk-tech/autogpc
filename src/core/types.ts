// Core domain types — UI-free and platform-agnostic on purpose.
// A future Expo / React Native shell should be able to import this file unchanged.

export type LineItem = {
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  total: string | null;
};

export type DocumentChecklist = {
  receiptUploaded: boolean;
  invoiceUploaded: boolean;
  quoteUploaded: boolean;
  approvalDocUploaded: boolean;
  otherDocsUploaded: boolean;
};

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
  section889: Saved889 | null; // saved 889 determination, set on the record detail page
  rawOcrText: string;
  imageUri: string;
  status: RecordStatus;
  documentChecklist: DocumentChecklist;
  captureSeconds: number | null; // measured capture time (retained on the record; no longer surfaced)
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

export const SOURCE_LABELS: Record<ExtractionSource, string> = {
  pdf_text: "PDF text layer",
  tesseract: "OCR (Tesseract)",
  cloud: "Cloud extractor",
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
