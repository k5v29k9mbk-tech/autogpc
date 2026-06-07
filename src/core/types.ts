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
