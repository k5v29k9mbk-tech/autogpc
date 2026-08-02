import { describe, expect, it } from "vitest";
import { mergeCloudExtraction, resultFromText, type CloudPayload } from "./resultFromText";

const RECEIPT_TEXT = [
  "EXCHANGE",
  "Ramstein KMCC Mall",
  "www.shopmyexchange.com",
  "Date: 10/17/2024",
  "EXTCORD ORNG 50FT 14.99",
  "TOTAL $38.96",
].join("\n");

function payload(over: Partial<CloudPayload> = {}): CloudPayload {
  return {
    fields: {},
    rawText: RECEIPT_TEXT,
    rawTextSource: "document",
    lineItems: [],
    confidence: 0.9,
    ...over,
  };
}

describe("resultFromText", () => {
  it("shapes the parse and no longer writes a shadow fields.lineItems", () => {
    const r = resultFromText(RECEIPT_TEXT, "tesseract", 0.8);
    expect(r.fields.totalAmount).toBe("38.96");
    expect(r.lineItems.length).toBeGreaterThan(0);
    // The old double-write diverged from lineItems on the cloud path.
    expect(r.fields.lineItems).toBeUndefined();
  });
});

describe("mergeCloudExtraction", () => {
  it("cloud fields win; the regex parse fills the gaps", () => {
    const r = mergeCloudExtraction(
      payload({ fields: { totalAmount: "40.00", vendor: "Ramstein KMCC Mall" } }),
    );
    expect(r.fields.totalAmount).toBe("40.00"); // cloud wins
    expect(r.fields.transactionDate).toBe("10/17/2024"); // parser filled the gap
    expect(r.source).toBe("cloud");
    expect(r.confidence).toBe(0.9);
  });

  it("blank cloud fields do not clobber parsed values", () => {
    const r = mergeCloudExtraction(payload({ fields: { totalAmount: "" } }));
    expect(r.fields.totalAmount).toBe("38.96");
  });

  it("a known vendor overrides whatever the cloud labeled VENDOR_NAME", () => {
    const r = mergeCloudExtraction(payload({ fields: { vendor: "Ramstein KMCC Mall" } }));
    expect(r.fields.vendor).toBe("EXCHANGE");
  });

  it("leaves the vendor blank on a synthetic summary rawText", () => {
    const r = mergeCloudExtraction(
      payload({ rawText: "AMOUNT_PAID: 555.65\nTOTAL: 555.65", rawTextSource: "summary" }),
    );
    expect(r.fields.vendor).toBe("");
  });

  it("prefers cloud line items, falling back to parsed rows", () => {
    const cloudRows = [{ description: "X", quantity: null, unitPrice: null, total: "1.00" }];
    expect(mergeCloudExtraction(payload({ lineItems: cloudRows })).lineItems).toEqual(cloudRows);
    expect(mergeCloudExtraction(payload()).lineItems.length).toBeGreaterThan(0);
  });
});
