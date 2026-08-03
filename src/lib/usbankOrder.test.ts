import { describe, expect, it } from "vitest";
import { toIsoDate, toUsBankOrder } from "./usbankOrder";
import { emptyChecklist, type PurchaseRecord } from "../core/types";

function record(over: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: "r1",
    vendor: "EXCHANGE",
    transactionDate: "10/17/2024",
    totalAmount: "38.96",
    currency: "USD",
    taxAmount: "0.00",
    cardLast4: "2287",
    receiptNumber: null,
    invoiceNumber: null,
    lineItems: [
      { description: "EXTCORD ORNG 50FT", quantity: "1", unitPrice: "14.99", total: "14.99" },
      { description: "EXTCORD ORNG 25FT", quantity: "3", unitPrice: "7.99", total: "23.97" },
    ],
    notes: "",
    requestorName: "Jordan Reyes",
    emergencyTypeOperation: "Not in support of ETO",
    designation889: "889 Merchant Rep",
    usBank: {
      specialPreApproval: "No Items Require Special Approvals",
      delegatedProcurementAuthority: "Micro-Purchase CH",
      prePurchaseApprovals: "None Required",
      section508Consideration: "No Item(s) in Order are Subject to 508 Requirement",
      requestToPurchaseReceived: "Self-Generated Purchase",
      spendAnalysis: "Office Supplies",
      requiredSourceScreened: "Purchased from Required Source",
      finalDeliveryOutsideUs: "No",
      lineItemTax: "1.20",
    },
    section889: null,
    rawOcrText: "",
    imageUri: "",
    status: "needs_review",
    documentChecklist: emptyChecklist(),
    source: "cloud",
    docType: "receipt",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...over,
  };
}

describe("toIsoDate", () => {
  it("passes ISO through and pads", () => {
    expect(toIsoDate("2026-05-02")).toBe("2026-05-02");
    expect(toIsoDate("2026-5-2")).toBe("2026-05-02");
  });
  it("reads slash dates US-style and dotted dates EU-style", () => {
    expect(toIsoDate("10/17/2024")).toBe("2024-10-17");
    expect(toIsoDate("22.04.2026")).toBe("2026-04-22");
  });
  it("reads the textual months quotes and invoices print", () => {
    expect(toIsoDate("Oct 17 2024")).toBe("2024-10-17");
  });
  it("returns null when unparseable", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("sometime last spring")).toBeNull();
  });
});

describe("toUsBankOrder", () => {
  it("maps the required + stored fields for a clean USD receipt", () => {
    const { payload, warnings } = toUsBankOrder(record(), { requestorName: "Jordan Reyes" });
    expect(payload.merchantName).toBe("EXCHANGE");
    expect(payload.requestorName).toBe("Jordan Reyes");
    expect(payload.amount).toBe(38.96);
    expect(payload.orderDate).toBe("2024-10-17");
    expect(payload.lineItems).toEqual([
      { productCode: null, description: "EXTCORD ORNG 50FT", qty: 1, unitCost: 14.99, lineTotal: 14.99 },
      { productCode: null, description: "EXTCORD ORNG 25FT", qty: 3, unitCost: 7.99, lineTotal: 23.97 },
    ]);
    // ETO is now a selector with a default, so only the 889 set-up note remains.
    expect(warnings).toEqual([expect.stringContaining("889")]);
  });

  it("sends the reviewer's order fields under the clone's own key names", () => {
    const { payload } = toUsBankOrder(record(), { requestorName: "Jordan Reyes" });
    // Anything missing from the body renders as the literal "null" on the
    // clone's order page — this is the whole point of the mapping.
    expect(payload).toMatchObject({
      specialPreApproval: "No Items Require Special Approvals",
      delegatedAuthority: "Micro-Purchase CH",
      prePurchApprovals: "None Required",
      section508: "No Item(s) in Order are Subject to 508 Requirement",
      requestToPurchase: "Self-Generated Purchase",
      spendAnalysis: "Office Supplies",
      requiredSource: "Purchased from Required Source",
      finalDelivery: "No",
      designation889: "889 Merchant Rep",
      totalTax: "0.00",
      lineItemTax: "1.20",
      sourceCurrency: "U.S. Dollar",
    });
  });

  it("passes a non-USD receipt's currency through as the source currency", () => {
    const { payload } = toUsBankOrder(record({ currency: "eur" }), { requestorName: "X" });
    expect(payload.sourceCurrency).toBe("EUR");
  });

  it("warns when a legacy record has no order fields at all", () => {
    const { payload, warnings } = toUsBankOrder(record({ usBank: null }), { requestorName: "X" });
    expect(payload.spendAnalysis).toBe("");
    expect(warnings.some((w) => w.includes("predates"))).toBe(true);
  });

  it("warns when the requestor name is missing (API requires it)", () => {
    const { payload, warnings } = toUsBankOrder(record());
    expect(payload.requestorName).toBe("");
    expect(warnings.some((w) => w.toLowerCase().includes("requestor"))).toBe(true);
  });

  it("warns when the amount isn't USD", () => {
    const { warnings } = toUsBankOrder(
      record({ currency: "EUR", totalAmount: "141.60" }),
      { requestorName: "Jordan Reyes" },
    );
    expect(warnings.some((w) => w.includes("EUR"))).toBe(true);
  });

  it("parses messy amounts and omits an unparseable date", () => {
    const { payload, warnings } = toUsBankOrder(
      record({ totalAmount: "$1,234.56", transactionDate: "sometime last spring" }),
      { requestorName: "X" },
    );
    expect(payload.amount).toBe(1234.56);
    expect(payload.orderDate).toBeUndefined();
    expect(warnings.some((w) => w.includes("default to today"))).toBe(true);
  });

  it("flags missing merchant and empty line items", () => {
    const { warnings } = toUsBankOrder(record({ vendor: "  ", lineItems: [] }), { requestorName: "X" });
    expect(warnings.some((w) => w.toLowerCase().includes("merchant"))).toBe(true);
    expect(warnings.some((w) => w.toLowerCase().includes("line items"))).toBe(true);
  });

  it("reads the currency off the record, case-insensitively", () => {
    const { warnings } = toUsBankOrder(record({ currency: "eur" }), { requestorName: "X" });
    expect(warnings.some((w) => w.includes("EUR"))).toBe(true);
  });
});
