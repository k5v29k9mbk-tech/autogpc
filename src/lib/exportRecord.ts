// Export helpers: a copy-pasteable structured summary for later MANUAL US Bank
// entry, and a JSON object. No automated submission anywhere.

import {
  DOC_TYPE_LABELS,
  STATUS_LABELS,
  type DocumentChecklist,
  type PurchaseRecord,
} from "../core/types";
import { formatAmount, formatTimer, orDash } from "./format";

const CHECKLIST_LABELS: Record<keyof DocumentChecklist, string> = {
  receiptUploaded: "Receipt",
  invoiceUploaded: "Invoice",
  quoteUploaded: "Quote",
  approvalDocUploaded: "Approval doc",
  otherDocsUploaded: "Other",
};

export function documentsPresent(checklist: DocumentChecklist): string[] {
  return (Object.keys(CHECKLIST_LABELS) as (keyof DocumentChecklist)[])
    .filter((k) => checklist[k])
    .map((k) => CHECKLIST_LABELS[k]);
}

export function documentsMissing(checklist: DocumentChecklist): string[] {
  return (Object.keys(CHECKLIST_LABELS) as (keyof DocumentChecklist)[])
    .filter((k) => !checklist[k])
    .map((k) => CHECKLIST_LABELS[k]);
}

export function toStructuredText(record: PurchaseRecord): string {
  const present = documentsPresent(record.documentChecklist);
  const missing = documentsMissing(record.documentChecklist);
  const lines: string[] = [];

  lines.push("AUTOGPC - Structured purchase summary");
  lines.push("For manual GPC / US Bank entry. AutoGPC does not submit anything.");
  lines.push("");
  const pair = (label: string, value: string) => `${label.padEnd(18)}${value}`;
  lines.push(pair("Vendor:", orDash(record.vendor)));
  lines.push(pair("Transaction date:", orDash(record.transactionDate)));
  lines.push(pair("Total:", formatAmount(record.totalAmount, record.currency)));
  lines.push(pair("Tax / VAT:", record.taxAmount ? formatAmount(record.taxAmount, record.currency) : "—"));
  lines.push(pair("Currency:", orDash(record.currency)));
  lines.push(pair("Receipt number:", orDash(record.receiptNumber)));
  lines.push(pair("Invoice number:", orDash(record.invoiceNumber)));
  lines.push(pair("Card last 4:", orDash(record.cardLast4)));
  lines.push(pair("Document type:", DOC_TYPE_LABELS[record.docType]));
  lines.push(pair("Status:", STATUS_LABELS[record.status]));

  if (record.lineItems.length) {
    lines.push("");
    lines.push("Line items:");
    for (const li of record.lineItems) {
      const qty = li.quantity ? `${li.quantity} x ` : "";
      const total = li.total ? formatAmount(li.total, record.currency) : "";
      lines.push(`  - ${li.description}  ${qty}${total}`.trimEnd());
    }
  }

  lines.push("");
  lines.push(pair("Documents present:", present.length ? present.join(", ") : "none"));
  lines.push(pair("Documents missing:", missing.length ? missing.join(", ") : "none"));

  if (record.notes.trim()) {
    lines.push("");
    lines.push(`Notes: ${record.notes.trim()}`);
  }

  if (record.captureSeconds != null) {
    lines.push("");
    lines.push(pair("Captured in:", `${formatTimer(record.captureSeconds)} (manual baseline ~12 min)`));
  }

  return lines.join("\n");
}

/** JSON-friendly object. Omits the bulky image data URI. */
export function toExportObject(record: PurchaseRecord) {
  const { imageUri: _imageUri, ...rest } = record;
  return { ...rest, image: "[stored locally on device]" };
}

export function toJson(record: PurchaseRecord): string {
  return JSON.stringify(toExportObject(record), null, 2);
}
