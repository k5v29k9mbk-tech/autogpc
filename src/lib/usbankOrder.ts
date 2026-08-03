// Map a Nexus PurchaseRecord onto the US Bank "Access Online" clone's
// Create-Order payload (POST /api/orders in k5v29k9mbk-tech/usbank-clone).
//
// The clone's API contract:
//   required : merchantName, requestorName
//   promoted to columns : amount (number), orderDate (YYYY-MM-DD)
//   everything else in the body is stored verbatim in the order's `details`
//   JSONB and read back by the detail page as `details.<key>` — so the keys
//   below must match ITS names, not ours, and any key we omit renders on that
//   page as the literal string "null".
//   Emergency-Type Operation has no field on the clone's form, so it stays on
//   the record only.
//
// Pure and UI-free so it can be unit-tested and reused by a future iOS shell.

import { toIsoDate } from "../core/dates";
import type { LineItem, PurchaseRecord } from "../core/types";

// Re-exported for existing importers/tests; core/dates owns the implementation.
export { toIsoDate };

export type UsBankLineItem = {
  productCode: string | null;
  description: string;
  qty: number | null;
  unitCost: number | null;
  lineTotal: number | null;
};

/**
 * The Create-Order form fields, keyed exactly as the clone's order-detail page
 * reads them back (`d.<key>` in usbank-clone/public/app.js). Our record names
 * them differently — this is the translation layer, and the only place the two
 * vocabularies meet.
 */
export type UsBankOrderDetails = {
  specialPreApproval: string;
  delegatedAuthority: string;
  prePurchApprovals: string;
  section508: string;
  requestToPurchase: string;
  spendAnalysis: string;
  requiredSource: string;
  finalDelivery: string;
  designation889: string;
  totalTax: string;
  lineItemTax: string;
  sourceCurrency: string;
  invoice: string;
  merchantAddress: string;
  merchantCity: string;
  merchantState: string;
  merchantPostal: string;
  shipCity: string;
  shipState: string;
  shipPostal: string;
};

/** Exactly what POST /api/orders accepts. */
export type UsBankOrderPayload = UsBankOrderDetails & {
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

function mapLineItem(li: LineItem): UsBankLineItem {
  return {
    productCode: li.productCode ?? null,
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
  opts: { requestorName?: string } = {},
): UsBankOrderDraft {
  const warnings: string[] = [];

  const merchantName = record.vendor.trim();
  if (!merchantName) warnings.push("Merchant name is required but wasn't extracted — add the vendor.");

  const requestorName = (opts.requestorName ?? "").trim();
  if (!requestorName)
    warnings.push("Requestor name is required — set it to the cardholder / account name.");

  const amount = toNumber(record.totalAmount) ?? 0;
  if (amount <= 0) warnings.push("Amount is required and must be greater than 0.");

  // The reviewer confirmed the currency on Review; US Bank's Source Currency is required.
  const currency = record.currency.trim().toUpperCase();
  if (currency && currency !== "USD")
    warnings.push(`Source currency is ${currency} — enter the converted USD amount US Bank will settle.`);
  else if (!currency) warnings.push("Currency not detected — confirm the Source Currency before submitting.");

  const iso = toIsoDate(record.transactionDate);
  if (!iso && record.transactionDate.trim())
    warnings.push(`Couldn't parse the date "${record.transactionDate}" — order will default to today.`);

  const lineItems = record.lineItems.map(mapLineItem);
  if (lineItems.length === 0)
    warnings.push("No line items extracted — add them before submitting if required.");

  warnings.push("Confirm the 889 representation below and attach the downloaded record.");

  // The reviewer's Create-Order answers. Records saved before these fields
  // existed have no `usBank` block — they'd land in US Bank as "null", so say so.
  const ub = record.usBank;
  if (!ub)
    warnings.push(
      "This record predates the US Bank order fields (Spend Analysis, Section 508, …) — they'll be blank in the order.",
    );

  const payload: UsBankOrderPayload = {
    merchantName,
    requestorName,
    amount,
    ...(iso ? { orderDate: iso } : {}),
    lineItems,
    specialPreApproval: ub?.specialPreApproval ?? "",
    delegatedAuthority: ub?.delegatedProcurementAuthority ?? "",
    prePurchApprovals: ub?.prePurchaseApprovals ?? "",
    section508: ub?.section508Consideration ?? "",
    requestToPurchase: ub?.requestToPurchaseReceived ?? "",
    spendAnalysis: ub?.spendAnalysis ?? "",
    requiredSource: ub?.requiredSourceScreened ?? "",
    finalDelivery: ub?.finalDeliveryOutsideUs ?? "",
    designation889: record.designation889 ?? "",
    totalTax: record.taxAmount ?? "0.00",
    lineItemTax: ub?.lineItemTax ?? "0.00",
    // The clone's own default label for USD; anything else is the OCONUS currency.
    sourceCurrency: currency && currency !== "USD" ? currency : "U.S. Dollar",
    // Textract files an INVOICE_RECEIPT_ID under receiptNumber, so the invoice
    // field is empty on cloud-extracted receipts unless we fall back to it.
    invoice: record.invoiceNumber || record.receiptNumber || "",
    merchantAddress: ub?.merchantAddress ?? "",
    merchantCity: ub?.merchantCity ?? "",
    merchantState: ub?.merchantState ?? "",
    merchantPostal: ub?.merchantPostal ?? "",
    shipCity: ub?.shipCity ?? "",
    shipState: ub?.shipState ?? "",
    shipPostal: ub?.shipPostal ?? "",
  };

  return { payload, warnings };
}
