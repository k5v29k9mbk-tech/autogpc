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

function clean(s?: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Strip currency symbols/spaces but keep digits, separators, and sign. */
function amount(s?: string): string {
  return clean(s).replace(/[^0-9.,-]/g, "");
}

function buildRawText(doc?: ExpenseDocument): string {
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
  return lines.join("\n");
}

function mapAnalyzeExpense(out: AnalyzeExpenseCommandOutput) {
  const doc = out.ExpenseDocuments?.[0];
  const fields: Record<string, string | null> = {};
  const confidences: number[] = [];
  let currency = "";

  for (const f of doc?.SummaryFields ?? []) {
    const type = f.Type?.Text;
    const value = f.ValueDetection?.Text;
    const conf = f.ValueDetection?.Confidence;
    if (f.Currency?.Code && !currency) currency = f.Currency.Code;

    switch (type) {
      case "VENDOR_NAME":
        // Authoritative — but never clobber a previous hit with an empty value.
        if (clean(value)) fields.vendor = clean(value);
        break;
      case "NAME":
        // Generic NAME can be the customer/recipient; only fill a gap with it.
        if (!fields.vendor && clean(value)) fields.vendor = clean(value);
        break;
      case "TOTAL":
        fields.totalAmount = amount(value);
        break;
      case "TAX":
        fields.taxAmount = amount(value) || null;
        break;
      case "INVOICE_RECEIPT_DATE":
        fields.transactionDate = clean(value);
        break;
      case "INVOICE_RECEIPT_ID":
      case "RECEIPT_ID":
        fields.receiptNumber = clean(value) || null;
        break;
      default:
        break;
    }
    if (type && ["VENDOR_NAME", "NAME", "TOTAL", "TAX", "INVOICE_RECEIPT_DATE"].includes(type) && typeof conf === "number") {
      confidences.push(conf);
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
      if (row.description || row.total) lineItems.push(row);
    }
  }

  const confidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
      : undefined;

  return { fields, rawText: buildRawText(doc), lineItems, confidence };
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
    res.status(200).json(mapAnalyzeExpense(out));
  } catch (err) {
    // Surface the AWS error NAME + message (safe — no document or credentials)
    // so the browser console shows the real cause, e.g. AccessDeniedException.
    const name = err instanceof Error ? err.name : "Error";
    const message = err instanceof Error ? err.message : String(err);
    console.error("AnalyzeExpense failed:", name, message);
    res.status(502).json({ error: "Cloud extraction failed", name, message });
  }
}
