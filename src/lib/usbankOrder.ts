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

// ---------------------------------------------------------------------------
// US Bank Access Online "Create Order" required dropdowns (red-asterisk fields).
// Values are the exact option strings US Bank renders, so what the reviewer
// picks here can be typed straight back into the order form. The last four
// exception values repeat across most of these menus, so factor them out.
// ---------------------------------------------------------------------------

const TXN_EXCEPTIONS = [
  "Refund or Credit",
  "External Fraud",
  "Disputed Transaction",
  "US Bank Fee (e.g. Convenience Check)",
] as const;

export const SPECIAL_PRE_APPROVAL_OPTIONS = [
  "No Items Require Special Approvals",
  "Yes-Bottled Water",
  "Yes-Hazardous Material",
  "Yes-Unmanned Aerial Systems (UAS)",
  "Yes-IT",
  "Yes-Other-Identify in Comments Fields",
  "Yes-Multiple-Identify All in Comments Fields",
  "Non-Compliant: Required Pre-Approval not Obtained",
  ...TXN_EXCEPTIONS,
] as const;

export const DELEGATED_PROCUREMENT_AUTHORITY_OPTIONS = [
  "Micro-Purchase CH",
  "Micro-Purchase Convenience Check Writer",
  "Micro-Purchase ETO CH and/or Check Writer",
  "Higher Education Micro-Purchase CH",
  "Warranted Overseas ETO CH",
  "Contract Ordering Official CH",
  "Contract Ordering Official CH in Support of ETO",
  "Overseas Simplified Acquisition CH",
  "Contract Payment Official CH",
  "Misc Payments Official CH (SF-182 Training)",
  "Intragovernmental Payment Official CH",
  ...TXN_EXCEPTIONS,
] as const;

export const PREPURCHASE_APPROVALS_OPTIONS = [
  "Yes-Both Obtained",
  "Only A/BO Approval Obtained, see comments",
  "Only RM/FM Approval Obtained, see comments",
  "No Pre-Purch Approvals were Obtained, see comments",
  "None Required",
  ...TXN_EXCEPTIONS,
] as const;

export const SECTION_508_OPTIONS = [
  "No Item(s) in Order are Subject to 508 Requirement",
  "Contract Order/Payment",
  "SF-182 Payment",
  "Yes-Subject Item(s) are Compliant",
  "Yes-Exception (Excp)-Legacy ICT (Safe Harbor)",
  "Yes-Excp-National Security Systems",
  "Yes-Excp-Federal Contract (ICT that is incidental)",
  "Yes-Excp-In Maintenance/Monitoring Spaces",
  "Yes-Excp-Undue Burden/Fundamental Alteration",
  "Yes-Excp-Best meets",
  "Yes-Excp-Revised 508 Standards Applicability CkLst",
  "Non-Compliant: Subject Item(s) are not Compliant",
  ...TXN_EXCEPTIONS,
] as const;

export const REQUEST_TO_PURCHASE_OPTIONS = [
  "Written Request Provided",
  "Self-Generated Purchase",
  ...TXN_EXCEPTIONS,
] as const;

// ponytail: TRUNCATED — the US Bank "Spend Analysis" menu scrolls past
// "Training & Development"; these are the options visible in the screenshot.
// Paste the remaining categories here when you have the full list.
export const SPEND_ANALYSIS_OPTIONS = [
  "Awards, Outreach Materials, & Printing",
  "Fleet Management & Vehicle Leases",
  "Furniture, Fixtures, & Furnishings",
  "Individual Issue Items, Tools, & PPE",
  "Industrial, Lab, & Shop Supplies",
  "IT Equipment (Hardware)",
  "IT Infrastructure (Voice, Data, Wireless)",
  "IT Maintenance & Sustainment",
  "IT Services (Labor)",
  "IT Software (licenses & Subscriptions)",
  "Lodging & Short Term Facility Leases",
  "Minor Construction & Facilities Services",
  "Morale, Welfare & Recreation (MWR)",
  "Office Supplies",
  "Postage & Freight",
  "Safety & Protective Equipment",
  "Subscriptions & Publications",
  "Tools, Maintenance, & Repair Supplies",
  "Training & Development",
] as const;

export const REQUIRED_SOURCE_SCREENED_OPTIONS = [
  "Purchased from Required Source",
  "Exception or Waiver Applies",
  "No FAR 8 Required or Other Required Sources Apply",
  "Contract Payment",
  "SF-182 Payment",
  "Non-Compliant: Not Purchased from Required Source",
  ...TXN_EXCEPTIONS,
] as const;

export const FINAL_DELIVERY_OUTSIDE_US_OPTIONS = [
  "No",
  "Yes-But No Merchant Shipping Required",
  "Yes-Ship Commercial Carrier (eg DHL)-DTS NOT req",
  "Yes-Via Postal Service to APO/FPO",
  "Yes-MSLabel Provided to Vendor for DTS Shipment",
  ...TXN_EXCEPTIONS,
] as const;

/**
 * Seed the "Final Delivery Outside US?" dropdown from the cardholder's duty
 * station OCONUS flag (see lib/dutyStations). CONUS → "No"; OCONUS → APO/FPO
 * (the standard overseas military delivery channel); unknown → blank so the
 * reviewer picks. Only a default — the reviewer confirms or overrides on save.
 */
export function finalDeliveryDefault(oconus: boolean | null | undefined): string {
  if (oconus === true) return "Yes-Via Postal Service to APO/FPO";
  if (oconus === false) return "No";
  return "";
}

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
