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
    designation889: null,
    section889: null,
    rawOcrText: "",
    imageUri: "",
    status: "needs_review",
    documentChecklist: emptyChecklist(),
    captureSeconds: 30,
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
  it("returns null when unparseable", () => {
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("Oct 17 2024")).toBeNull();
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
      record({ totalAmount: "$1,234.56", transactionDate: "Oct 17 2024" }),
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

  it("carries tax + ETO default + currency in manual fields", () => {
    const { manual } = toUsBankOrder(record({ taxAmount: "2.50" }), { requestorName: "X" });
    expect(manual.totalTax).toBe(2.5);
    expect(manual.emergencyTypeOperation).toBe("Not in support of ETO");
    expect(manual.designation889).toBeNull();
    expect(manual.currency).toBe("USD");
  });

  it("honors an ETO and currency override", () => {
    const { manual, warnings } = toUsBankOrder(record(), {
      requestorName: "X",
      eto: "In Support of ETO",
      currency: "eur",
    });
    expect(manual.emergencyTypeOperation).toBe("In Support of ETO");
    expect(manual.currency).toBe("EUR");
    expect(warnings.some((w) => w.includes("EUR"))).toBe(true);
  });
});
