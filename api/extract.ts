// /api/extract — Vercel serverless function (Node runtime).
//
// This is the ONLY place the AWS credentials live. The browser sends a
// base64-encoded document; this function calls Textract AnalyzeExpense and
// returns the mapped fields. Credentials come from server-side env vars
// (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) — never VITE_-prefixed,
// never in the client bundle.
//
// PII NOTE: commercial Textract regions are fine for SYNTHETIC / scrubbed demo
// data only. Real GPC PII must go to an AWS GovCloud region under an ATO.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  TextractClient,
  AnalyzeExpenseCommand,
  type AnalyzeExpenseCommandOutput,
  type ExpenseDocument,
} from "@aws-sdk/client-textract";
import { clean, ocrLines, selectVendor } from "./textractPostProcessor";
import { ADJUSTMENT_ROW } from "../src/core/vendorRules";
import { normalizeAmount } from "../src/core/parseReceipt";

// Vercel runs functions on AWS Lambda, which RESERVES the env names AWS_REGION,
// AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY for its own runtime — setting
// those in Vercel can be ignored or overridden by the function's execution
// role (showing up as a confusing 403). So we read TEXTRACT_*-prefixed vars and
// pass credentials explicitly, falling back to AWS_* / the default provider
// chain for local dev or non-Lambda hosts.
const accessKeyId = process.env.TEXTRACT_ACCESS_KEY_ID;
const secretAccessKey = process.env.TEXTRACT_SECRET_ACCESS_KEY;
const client = new TextractClient({
  region: process.env.TEXTRACT_REGION ?? process.env.AWS_REGION,
  credentials:
    accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
});

type LineItem = {
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  total: string | null;
};

/**
 * Normalize a monetary string to a plain "1234.56" form. Delegates to the
 * client parser's normalizeAmount so BOTH engines emit the same number format —
 * a Textract TOTAL of "1.234,56" used to pass through EU-grouped while the
 * regex path emitted "1234.56", splitting record.totalAmount by engine.
 */
function amount(s?: string): string {
  return normalizeAmount(clean(s)) ?? "";
}

// Prefer the document's real OCR lines (ExpenseDocument.Blocks) so rawText
// reads top-to-bottom like the printed receipt — that lets the client's regex
// parser fill gaps positionally (e.g. vendor = top line). Only when Blocks are
// missing do we fall back to a synthetic "TYPE: value" summary list, flagged
// via `source` so the client skips position-based heuristics on it.
function buildRawText(doc?: ExpenseDocument): { text: string; source: "document" | "summary" } {
  // The confidence floor (see ocrLines) is one bleed-through layer, not the
  // whole defense — it can reach the 80s, so parseVendor also anchors on the
  // contact block client-side.
  const docLines = ocrLines(doc).map((l) => l.text);
  if (docLines.length) return { text: docLines.join("\n"), source: "document" };

  const lines: string[] = [];
  for (const f of doc?.SummaryFields ?? []) {
    const label = clean(f.Type?.Text ?? f.LabelDetection?.Text);
    const value = clean(f.ValueDetection?.Text);
    if (label || value) lines.push(`${label}: ${value}`.trim());
  }
  for (const g of doc?.LineItemGroups ?? []) {
    for (const li of g.LineItems ?? []) {
      const cells = (li.LineItemExpenseFields ?? [])
        .map((lf) => clean(lf.ValueDetection?.Text))
        .filter(Boolean);
      if (cells.length) lines.push(cells.join("  "));
    }
  }
  return { text: lines.join("\n"), source: "summary" };
}

export function mapAnalyzeExpense(out: AnalyzeExpenseCommandOutput) {
  const doc = out.ExpenseDocuments?.[0];
  const fields: Record<string, string | null> = {};
  // Per-field confidence (0..1): money/date carry Textract's own confidence;
  // vendor carries the post-processor's score. The review UI can flag the shaky
  // fields instead of treating every auto-fill as equally trustworthy.
  const fieldConfidence: Record<string, number> = {};
  // Vendor is selected separately (see selectVendor) from these candidates plus
  // the top OCR lines — Textract's VENDOR_NAME label alone is the field it most
  // often gets wrong on thermal scans.
  const vendorCandidates: Array<{ text: string; label: "VENDOR_NAME" | "NAME"; confidence: number }> = [];
  let currency = "";

  for (const f of doc?.SummaryFields ?? []) {
    const type = f.Type?.Text;
    const value = f.ValueDetection?.Text;
    const conf = f.ValueDetection?.Confidence ?? 0;
    if (f.Currency?.Code && !currency) currency = f.Currency.Code;

    switch (type) {
      case "VENDOR_NAME":
        vendorCandidates.push({ text: clean(value), label: "VENDOR_NAME", confidence: conf });
        break;
      case "NAME":
        vendorCandidates.push({ text: clean(value), label: "NAME", confidence: conf });
        break;
      case "TOTAL":
        fields.totalAmount = amount(value);
        fieldConfidence.totalAmount = conf / 100;
        break;
      case "TAX": {
        const tax = amount(value) || null;
        fields.taxAmount = tax;
        if (tax) fieldConfidence.taxAmount = conf / 100;
        break;
      }
      case "INVOICE_RECEIPT_DATE":
        fields.transactionDate = clean(value);
        fieldConfidence.transactionDate = conf / 100;
        break;
      case "INVOICE_RECEIPT_ID":
      case "RECEIPT_ID":
        fields.receiptNumber = clean(value) || null;
        break;
      default:
        break;
    }
  }
  if (currency) fields.currency = currency;

  const lineItems: LineItem[] = [];
  for (const g of doc?.LineItemGroups ?? []) {
    for (const li of g.LineItems ?? []) {
      const row: LineItem = { description: "", quantity: null, unitPrice: null, total: null };
      for (const lf of li.LineItemExpenseFields ?? []) {
        const t = lf.Type?.Text;
        const v = clean(lf.ValueDetection?.Text);
        if (t === "ITEM") row.description = v;
        else if (t === "QUANTITY") row.quantity = v || null;
        else if (t === "UNIT_PRICE") row.unitPrice = amount(v) || null;
        else if (t === "PRICE") row.total = amount(v) || null;
      }
      // Textract sometimes folds the qty line into ITEM ("... 4 @ 22.46 =");
      // qty/unit price are captured in their own fields, so strip the suffix.
      row.description = row.description.replace(/\s+\d{1,4}\s*@\s*[\d.,]+\s*=?\s*$/, "");
      if (ADJUSTMENT_ROW.test(row.description)) continue;
      if (row.total?.startsWith("-")) continue; // negative rows are discounts
      if (row.description || row.total) lineItems.push(row);
    }
  }

  const raw = buildRawText(doc);

  // Vendor selection: blacklist + shape + OCR corroboration + positional
  // scoring over Textract's candidates and the top OCR lines (see selectVendor).
  const { vendor, confidence: vendorConf } = selectVendor(vendorCandidates, doc, raw.source);
  if (vendor) {
    fields.vendor = vendor;
    fieldConfidence.vendor = vendorConf;
  }

  const confs = Object.values(fieldConfidence);
  const confidence =
    confs.length > 0
      ? Number((confs.reduce((a, b) => a + b, 0) / confs.length).toFixed(2))
      : undefined;

  return { fields, rawText: raw.text, rawTextSource: raw.source, lineItems, confidence, fieldConfidence };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { fileBase64 } = (req.body ?? {}) as { fileBase64?: string };
    if (!fileBase64) {
      res.status(400).json({ error: "Missing fileBase64" });
      return;
    }
    // Wrap in a fresh Uint8Array so the bytes are backed by a plain ArrayBuffer
    // (avoids the @types/node Buffer vs Uint8Array<ArrayBuffer> mismatch).
    const bytes = new Uint8Array(Buffer.from(fileBase64, "base64"));
    const out = await client.send(new AnalyzeExpenseCommand({ Document: { Bytes: bytes } }));
    const result = mapAnalyzeExpense(out);
    // ponytail: dev-only raw-Textract capture for seeding golden fixtures
    // (api/fixtures/). PII — gate on an explicit env var, never on in prod.
    if (process.env.EXTRACT_DEBUG === "1") {
      (result as Record<string, unknown>)._rawTextract = out;
    }
    res.status(200).json(result);
  } catch (err) {
    // Surface the AWS error NAME + message (safe — no document or credentials)
    // so the browser console shows the real cause, e.g. AccessDeniedException.
    const name = err instanceof Error ? err.name : "Error";
    const message = err instanceof Error ? err.message : String(err);
    console.error("AnalyzeExpense failed:", name, message);
    res.status(502).json({ error: "Cloud extraction failed", name, message });
  }
}
