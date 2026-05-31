import { describe, it, expect } from "vitest";
import {
  parseReceipt,
  normalizeAmount,
  detectCurrency,
  parseDate,
  parseTotal,
  parseTax,
  parseCardLast4,
  parseVendor,
  parseInvoiceNumber,
  parseReceiptNumber,
} from "./parseReceipt";

describe("normalizeAmount", () => {
  it("handles US grouping", () => {
    expect(normalizeAmount("$1,234.56")).toBe("1234.56");
    expect(normalizeAmount("1,234")).toBe("1234");
    expect(normalizeAmount("99.95")).toBe("99.95");
  });
  it("handles EU grouping", () => {
    expect(normalizeAmount("1.234,56 €")).toBe("1234.56");
    expect(normalizeAmount("12,00")).toBe("12.00");
    expect(normalizeAmount("1.234")).toBe("1234");
  });
  it("returns null for non-numeric", () => {
    expect(normalizeAmount("TOTAL")).toBeNull();
    expect(normalizeAmount("")).toBeNull();
  });
});

describe("detectCurrency", () => {
  it("detects USD and EUR", () => {
    expect(detectCurrency("TOTAL $42.00")).toBe("USD");
    expect(detectCurrency("Gesamt 42,00 €")).toBe("EUR");
    expect(detectCurrency("MwSt 19%")).toBe("EUR");
  });
  it("returns null when absent", () => {
    expect(detectCurrency("just some text 42")).toBeNull();
  });
});

describe("parseDate", () => {
  it("reads the four supported formats", () => {
    expect(parseDate("Date: 03/14/2026")).toBe("03/14/2026");
    expect(parseDate("Datum 14.03.2026")).toBe("14.03.2026");
    expect(parseDate("Issued 2026-03-14")).toBe("2026-03-14");
  });
  it("prefers a date next to a date label", () => {
    const text = "Printed 01/01/2000\nTransaction Date 05/20/2026";
    expect(parseDate(text)).toBe("05/20/2026");
  });
});

describe("parseTotal / parseTax", () => {
  it("prefers grand total over subtotal and tax", () => {
    const text = ["Subtotal $40.00", "Sales Tax $3.20", "TOTAL $43.20"].join("\n");
    expect(parseTotal(text)).toBe("43.20");
    expect(parseTax(text)).toBe("3.20");
  });
  it("ignores the percentage in a VAT line", () => {
    const text = "Zwischensumme 100,00\nMwSt 19% 19,00\nGesamt 119,00";
    expect(parseTotal(text)).toBe("119.00");
    expect(parseTax(text)).toBe("19.00");
  });
});

describe("parseCardLast4", () => {
  it("reads masked and labelled cards", () => {
    expect(parseCardLast4("MASTERCARD **** 4421")).toBe("4421");
    expect(parseCardLast4("VISA 1234")).toBe("1234");
    expect(parseCardLast4("ending in 9087")).toBe("9087");
    expect(parseCardLast4("xxxx-3321")).toBe("3321");
  });
  it("returns null when no card present", () => {
    expect(parseCardLast4("no card here 12 34")).toBeNull();
  });
});

describe("reference numbers", () => {
  it("extracts invoice and receipt numbers", () => {
    expect(parseInvoiceNumber("Invoice No: INV-20451")).toBe("INV-20451");
    expect(parseReceiptNumber("Transaction #A8842")).toBe("A8842");
  });
  it("requires a digit (does not grab words)", () => {
    expect(parseInvoiceNumber("Invoice for services")).toBeNull();
  });
});

describe("parseVendor", () => {
  it("takes the storefront line, skipping headers", () => {
    expect(parseVendor("RECEIPT\nUnited Office Solutions\n123 Main St")).toBe(
      "United Office Solutions",
    );
  });
});

describe("parseReceipt — full documents", () => {
  it("US thermal store receipt (USD, MM/DD/YYYY, MasterCard)", () => {
    const raw = [
      "EXCHANGE MAIN STORE",
      "Ramstein AB",
      "Date 03/14/2026",
      "Trans #88241007",
      "Coffee Maker        49.99",
      "USB-C Cable          12.49",
      "Subtotal            62.48",
      "Sales Tax            0.00",
      "TOTAL              $62.48",
      "MASTERCARD **** 4421",
    ].join("\n");
    const r = parseReceipt(raw);
    expect(r.vendor).toBe("EXCHANGE MAIN STORE");
    expect(r.currency).toBe("USD");
    expect(r.transactionDate).toBe("03/14/2026");
    expect(r.totalAmount).toBe("62.48");
    expect(r.cardLast4).toBe("4421");
    expect(r.receiptNumber).toBe("88241007");
  });

  it("German EUR receipt with MwSt (DD.MM.YYYY, comma decimals)", () => {
    const raw = [
      "toom Baumarkt",
      "Kaiserslautern",
      "Datum 22.04.2026",
      "Beleg-Nr 5567",
      "Zwischensumme        100,00",
      "MwSt 19%              19,00",
      "Gesamt               119,00 €",
      "EC-Karte 8890",
    ].join("\n");
    const r = parseReceipt(raw);
    expect(r.vendor).toBe("toom Baumarkt");
    expect(r.currency).toBe("EUR");
    expect(r.transactionDate).toBe("22.04.2026");
    expect(r.totalAmount).toBe("119.00");
    expect(r.taxAmount).toBe("19.00");
    expect(r.cardLast4).toBe("8890");
    expect(r.receiptNumber).toBe("5567");
  });

  it("native-PDF vendor quote (clean text, line items, no tax)", () => {
    const raw = [
      "Better Direct LLC",
      "Quotation",
      "Quote No: Q-2026-0455",
      "Date: 2026-05-02",
      "Rugged Laptop Case   2 x 89.00   178.00",
      "Docking Station      1 x 210.00  210.00",
      "TOTAL               $388.00",
    ].join("\n");
    const r = parseReceipt(raw);
    expect(r.vendor).toBe("Better Direct LLC");
    expect(r.currency).toBe("USD");
    expect(r.transactionDate).toBe("2026-05-02");
    expect(r.totalAmount).toBe("388.00");
    expect(r.invoiceNumber).toBe("Q-2026-0455");
    expect(r.taxAmount).toBeNull();
    expect(r.lineItems.length).toBeGreaterThanOrEqual(2);
    expect(r.lineItems[0]).toMatchObject({ quantity: "2", total: "178.00" });
  });
});
