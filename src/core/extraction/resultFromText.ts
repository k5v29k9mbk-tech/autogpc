// Shared bridge: run the regex parser over raw text and shape the output into
// an ExtractionResult. Used by both the PDF-text and Tesseract providers so
// they structure fields identically.

import { parseReceipt } from "../parseReceipt";
import type { ExtractionSource, PurchaseRecord } from "../types";
import type { ExtractionResult } from "./extractionService";

export function resultFromText(
  rawText: string,
  source: ExtractionSource,
  confidence?: number,
): ExtractionResult {
  const parsed = parseReceipt(rawText);
  const fields: Partial<PurchaseRecord> = {
    vendor: parsed.vendor ?? "",
    transactionDate: parsed.transactionDate ?? "",
    totalAmount: parsed.totalAmount ?? "",
    currency: parsed.currency ?? "",
    taxAmount: parsed.taxAmount,
    cardLast4: parsed.cardLast4,
    receiptNumber: parsed.receiptNumber,
    invoiceNumber: parsed.invoiceNumber,
    lineItems: parsed.lineItems,
  };
  return { fields, rawText, lineItems: parsed.lineItems, source, confidence };
}
