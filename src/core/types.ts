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
  rawOcrText: string;
  imageUri: string;
  status: RecordStatus;
  documentChecklist: DocumentChecklist;
  captureSeconds: number | null; // measured capture time, for the time-saved features
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

// The assumed manual baseline the demo is pitched against: a cardholder spends
// ~10–15 min building a US Bank order by hand. We use 12 minutes as the midpoint.
export const MANUAL_BASELINE_SECONDS = 12 * 60;

export function emptyChecklist(): DocumentChecklist {
  return {
    receiptUploaded: false,
    invoiceUploaded: false,
    quoteUploaded: false,
    approvalDocUploaded: false,
    otherDocsUploaded: false,
  };
}
