// Map a Nexus PurchaseRecord onto the US Bank "Access Online" clone's
// Create-Order payload (POST /api/orders in k5v29k9mbk-tech/usbank-clone).
//
// The clone's API contract:
//   required : merchantName, requestorName
//   stored   : amount (number), orderDate (YYYY-MM-DD), lineItems[]
//                lineItems[] = { productCode, description, qty, unitCost, lineTotal }
//   NOT stored by the clone yet (form-only): Emergency-Type Operation, 889
//                Designation, Total/Line-Item Tax. We surface those as warnings /
//                manual fields rather than silently dropping them.
//
// Pure and UI-free so it can be unit-tested and reused by a future iOS shell.

import type { LineItem, PurchaseRecord } from "../core/types";

export type UsBankLineItem = {
  productCode: string | null;
  description: string;
  qty: number | null;
  unitCost: number | null;
  lineTotal: number | null;
};

/** Exactly what POST /api/orders accepts. */
export type UsBankOrderPayload = {
  merchantName: string;
  requestorName: string;
  amount: number;
  orderDate?: string; // YYYY-MM-DD; omitted => the clone defaults to today
  lineItems: UsBankLineItem[];
};

export type UsBankOrderDraft = {
  /** Ready to POST to the clone's /api/orders. */
  payload: UsBankOrderPayload;
  /** Things a human must confirm/fix before submitting. */
  warnings: string[];
  /** US Bank form fields the clone API can't persist yet — carried for the UI. */
  manual: {
    emergencyTypeOperation: string; // default; needs human confirmation
    designation889: string | null; // deferred to a later sprint
    totalTax: number | null;
    /** Source currency, ISO code. US Bank requires it; OCONUS orders aren't USD. */
    currency: string;
  };
};

/** ETO is almost always this; still requires a human to confirm per order. */
export const DEFAULT_ETO = "Not in support of ETO";

/** The two Emergency-Type Operation values US Bank accepts. */
export const ETO_OPTIONS = [DEFAULT_ETO, "In Support of ETO"] as const;

/**
 * Source currencies a GPC cardholder realistically uses: USD CONUS, plus the
 * common OCONUS theatres (EUR, GBP, JPY, KRW). US Bank's Source Currency field
 * is required, so the reviewer picks from these when a receipt isn't in USD.
 */
export const GPC_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "KRW"] as const;

function toNumber(s: string | null | undefined): number | null {
  if (s == null) return null;
  const cleaned = String(s).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize an extracted date to YYYY-MM-DD, or null if not confidently
 * parseable. Slash dates are read US-style (MM/DD/YYYY), dotted dates EU-style
 * (DD.MM.YYYY) — matching how parseReceipt detects them.
 */
export function toIsoDate(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // US MM/DD/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); // EU DD.MM.YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function mapLineItem(li: LineItem): UsBankLineItem {
  return {
    productCode: null,
    description: li.description.trim(),
    qty: toNumber(li.quantity),
    unitCost: toNumber(li.unitPrice),
    lineTotal: toNumber(li.total),
  };
}

/**
 * Build a US Bank order draft from a record.
 *
 * @param opts.requestorName the cardholder / account name. Receipts rarely
 *   contain it, so the caller supplies it (e.g. the signed-in US Bank
 *   cardholder). Left blank => a warning, since the API requires it.
 */
export function toUsBankOrder(
  record: PurchaseRecord,
  opts: { requestorName?: string; eto?: string; currency?: string } = {},
): UsBankOrderDraft {
  const warnings: string[] = [];

  const merchantName = record.vendor.trim();
  if (!merchantName) warnings.push("Merchant name is required but wasn't extracted — add the vendor.");

  const requestorName = (opts.requestorName ?? "").trim();
  if (!requestorName)
    warnings.push("Requestor name is required — set it to the cardholder / account name.");

  const amount = toNumber(record.totalAmount) ?? 0;
  if (amount <= 0) warnings.push("Amount is required and must be greater than 0.");

  // Reviewer override wins over the detected currency (e.g. an OCONUS receipt
  // whose symbol didn't survive OCR). US Bank's Source Currency is required.
  const currency = (opts.currency ?? record.currency).trim().toUpperCase();
  if (currency && currency !== "USD")
    warnings.push(`Source currency is ${currency} — enter the converted USD amount US Bank will settle.`);
  else if (!currency) warnings.push("Currency not detected — confirm the Source Currency before submitting.");

  const iso = toIsoDate(record.transactionDate);
  if (!iso && record.transactionDate.trim())
    warnings.push(`Couldn't parse the date "${record.transactionDate}" — order will default to today.`);

  const lineItems = record.lineItems.map(mapLineItem);
  if (lineItems.length === 0)
    warnings.push("No line items extracted — add them before submitting if required.");

  // Form-only fields the clone API can't store yet:
  warnings.push("Confirm the 889 representation below and attach the downloaded record.");

  const eto = (opts.eto ?? DEFAULT_ETO).trim() || DEFAULT_ETO;

  const payload: UsBankOrderPayload = {
    merchantName,
    requestorName,
    amount,
    ...(iso ? { orderDate: iso } : {}),
    lineItems,
  };

  return {
    payload,
    warnings,
    manual: {
      emergencyTypeOperation: eto,
      designation889: null,
      totalTax: toNumber(record.taxAmount),
      currency,
    },
  };
}
