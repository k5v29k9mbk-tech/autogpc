// Seeded sample records so the demo is alive on first launch.
//
// Every value is scrubbed / synthetic — no real names, .mil emails, CAGE codes,
// or card numbers. The four required document types are all represented (US
// thermal receipt, German EUR/MwSt receipt, native-PDF vendor quote, and a
// handwritten NATO SOFA VAT-relief form), plus a vendor invoice to round out
// the docType spread. States are mixed so the records list and the Home
// time-saved counter look real immediately.

import { parseReceipt } from "../core/parseReceipt";
import { MOCK_EXPLICIT, MOCK_RAW_TEXT } from "../core/extraction/mockService";
import { emptyChecklist, type DocumentChecklist, type PurchaseRecord } from "../core/types";
import { sampleImages } from "./sampleImages";

const INVOICE_RAW_TEXT = [
  "United Office Solutions",
  "Industriestr. 8, 67657 Kaiserslautern",
  "billing@uos.example",
  "",
  "INVOICE",
  "Invoice No: INV-20451",
  "Date: 2026-05-09",
  "",
  "Item                         Qty   Unit       Ext",
  "Office Chair Ergo            6     145.00    870.00",
  "Standing Desk Frame          3     320.00    960.00",
  "                                   Subtotal 1830.00",
  "                                   MwSt 19%  347.70",
  "                                   TOTAL    2177.70 EUR",
].join("\n");

function checklist(over: Partial<DocumentChecklist>): DocumentChecklist {
  return { ...emptyChecklist(), ...over };
}

type Seed = Omit<
  PurchaseRecord,
  | "vendor"
  | "transactionDate"
  | "totalAmount"
  | "currency"
  | "taxAmount"
  | "cardLast4"
  | "receiptNumber"
  | "invoiceNumber"
  | "lineItems"
> &
  Partial<
    Pick<
      PurchaseRecord,
      | "vendor"
      | "transactionDate"
      | "totalAmount"
      | "currency"
      | "taxAmount"
      | "cardLast4"
      | "receiptNumber"
      | "invoiceNumber"
      | "lineItems"
    >
  >;

function build(seed: Seed): PurchaseRecord {
  const p = parseReceipt(seed.rawOcrText);
  return {
    ...seed,
    vendor: seed.vendor ?? p.vendor ?? "",
    transactionDate: seed.transactionDate ?? p.transactionDate ?? "",
    totalAmount: seed.totalAmount ?? p.totalAmount ?? "",
    currency: seed.currency ?? p.currency ?? "",
    taxAmount: "taxAmount" in seed ? seed.taxAmount! : p.taxAmount,
    cardLast4: "cardLast4" in seed ? seed.cardLast4! : p.cardLast4,
    receiptNumber: "receiptNumber" in seed ? seed.receiptNumber! : p.receiptNumber,
    invoiceNumber: "invoiceNumber" in seed ? seed.invoiceNumber! : p.invoiceNumber,
    lineItems: seed.lineItems ?? p.lineItems,
  };
}

export const SAMPLE_RECORDS: PurchaseRecord[] = [
  build({
    id: "sample-thermal-us",
    rawOcrText: MOCK_RAW_TEXT.thermal_us,
    imageUri: sampleImages.thermal_us,
    notes: "AAFES Exchange purchase. Thermal print, OCR-read.",
    status: "needs_review",
    documentChecklist: checklist({ receiptUploaded: true }),
    captureSeconds: 41,
    source: "tesseract",
    docType: "receipt",
    createdAt: "2026-05-28T14:21:00.000Z",
    updatedAt: "2026-05-28T14:21:00.000Z",
  }),
  build({
    id: "sample-german-vat",
    rawOcrText: MOCK_RAW_TEXT.german_vat,
    imageUri: sampleImages.german_vat,
    notes: "German hardware store. EUR with 19% MwSt; comma decimals.",
    status: "reviewed",
    documentChecklist: checklist({ receiptUploaded: true }),
    captureSeconds: 53,
    source: "tesseract",
    docType: "receipt",
    createdAt: "2026-05-24T09:05:00.000Z",
    updatedAt: "2026-05-25T08:00:00.000Z",
  }),
  build({
    id: "sample-vendor-quote",
    rawOcrText: MOCK_RAW_TEXT.vendor_quote,
    imageUri: sampleImages.vendor_quote,
    notes: "Vendor-emailed PDF with a clean text layer — extracted instantly, no OCR.",
    status: "ready_for_entry",
    documentChecklist: checklist({ quoteUploaded: true }),
    captureSeconds: 11,
    source: "pdf_text",
    docType: "quote",
    createdAt: "2026-05-20T16:40:00.000Z",
    updatedAt: "2026-05-21T10:15:00.000Z",
  }),
  build({
    id: "sample-invoice-uos",
    rawOcrText: INVOICE_RAW_TEXT,
    imageUri: sampleImages.vendor_quote,
    notes: "Vendor invoice (native PDF). Line items + 19% MwSt extracted from text.",
    status: "exported",
    documentChecklist: checklist({ invoiceUploaded: true, approvalDocUploaded: true }),
    captureSeconds: 14,
    source: "pdf_text",
    docType: "invoice",
    createdAt: "2026-05-12T11:30:00.000Z",
    updatedAt: "2026-05-14T13:00:00.000Z",
  }),
  build({
    id: "sample-vat-form",
    rawOcrText: MOCK_RAW_TEXT.vat_form,
    imageUri: sampleImages.vat_form,
    ...MOCK_EXPLICIT.vat_form,
    notes: MOCK_EXPLICIT.vat_form?.notes ?? "",
    status: "needs_review",
    documentChecklist: checklist({ approvalDocUploaded: true, otherDocsUploaded: true }),
    captureSeconds: 72,
    source: "mock",
    docType: "vat_form",
    createdAt: "2026-05-18T08:10:00.000Z",
    updatedAt: "2026-05-18T08:10:00.000Z",
  }),
];
