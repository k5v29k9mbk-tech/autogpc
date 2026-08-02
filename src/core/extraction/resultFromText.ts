// Shared bridge: shape engine output into an ExtractionResult.
//
// resultFromText runs the regex parser over raw text (the PDF-text and
// Tesseract paths). mergeCloudExtraction layers a cloud response over that
// parse — the merge POLICY lives here, pure and unit-testable, not inside the
// HTTP adapter that happens to transport the cloud response.

import { parseReceipt } from "../parseReceipt";
import { detectKnownVendor } from "../knownVendors";
import type { ExtractionSource, LineItem, PurchaseRecord } from "../types";
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
  };
  return { fields, rawText, lineItems: parsed.lineItems, source, confidence };
}

/** What /api/extract returns (the fields the client actually reads). */
export type CloudPayload = {
  fields: Partial<PurchaseRecord>;
  rawText: string;
  /** "document" = real OCR lines in reading order; "summary" = synthetic "TYPE: value" list. */
  rawTextSource?: "document" | "summary";
  lineItems: LineItem[];
  confidence?: number;
};

/** Keep only fields that carry information, so they override regex gaps but blanks don't. */
function nonEmpty(fields: Partial<PurchaseRecord>): Partial<PurchaseRecord> {
  const out: Partial<PurchaseRecord> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== "" && value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

/**
 * Merge a cloud response with the regex parse of its raw text. The policy:
 *  - cloud-detected fields win; the regex parser fills gaps;
 *  - EXCEPT vendor on a "summary" rawText — the parser's positional vendor
 *    heuristic assumes real top-to-bottom OCR lines, so on the synthetic
 *    summary fallback the vendor stays blank for review rather than guessed;
 *  - a known vendor (core/knownVendors) overrides whatever Textract labeled
 *    VENDOR_NAME — e.g. Exchange receipts, where the storefront banner is an
 *    unreadable logo and Textract tends to label the mall or cashier;
 *  - cloud line items win when present, else the regex-parsed rows.
 */
export function mergeCloudExtraction(cloud: CloudPayload): ExtractionResult {
  const base = resultFromText(cloud.rawText, "cloud", cloud.confidence);
  if (cloud.rawTextSource !== "document") base.fields.vendor = "";
  const fields = { ...base.fields, ...nonEmpty(cloud.fields) };
  const known = detectKnownVendor(cloud.rawText);
  if (known) fields.vendor = known.name;
  const lineItems = cloud.lineItems?.length ? cloud.lineItems : base.lineItems;

  return {
    fields,
    rawText: cloud.rawText,
    lineItems,
    source: "cloud",
    confidence: cloud.confidence,
  };
}
