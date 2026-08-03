import { describe, it, expect } from "vitest";
import type { AnalyzeExpenseCommandOutput } from "@aws-sdk/client-textract";
import { mapAnalyzeExpense } from "./extract";

// Minimal fake of an AnalyzeExpense response; only the fields the mapper reads.
function fakeOutput(doc: unknown): AnalyzeExpenseCommandOutput {
  return { ExpenseDocuments: [doc] } as unknown as AnalyzeExpenseCommandOutput;
}

function summaryField(type: string, value: string, confidence = 95) {
  return { Type: { Text: type }, ValueDetection: { Text: value, Confidence: confidence } };
}

describe("mapAnalyzeExpense — vendor plausibility", () => {
  it("rejects bleed-through gibberish in VENDOR_NAME (muteR-style casing)", () => {
    const r = mapAnalyzeExpense(
      fakeOutput({ SummaryFields: [summaryField("VENDOR_NAME", "muteR"), summaryField("TOTAL", "40.45")] }),
    );
    expect(r.fields.vendor).toBeUndefined();
    expect(r.fields.totalAmount).toBe("40.45");
  });

  it("rejects all-lowercase single tokens but keeps real names", () => {
    const bad = mapAnalyzeExpense(fakeOutput({ SummaryFields: [summaryField("VENDOR_NAME", "pnivotomi")] }));
    expect(bad.fields.vendor).toBeUndefined();

    const ok = mapAnalyzeExpense(fakeOutput({ SummaryFields: [summaryField("VENDOR_NAME", "EXCHANGE")] }));
    expect(ok.fields.vendor).toBe("EXCHANGE");

    const multi = mapAnalyzeExpense(fakeOutput({ SummaryFields: [summaryField("VENDOR_NAME", "toom Baumarkt")] }));
    expect(multi.fields.vendor).toBe("toom Baumarkt");
  });

  it("rejects lowercase tokens with digits ('gorl2')", () => {
    const r = mapAnalyzeExpense(fakeOutput({ SummaryFields: [summaryField("VENDOR_NAME", "gorl2")] }));
    expect(r.fields.vendor).toBeUndefined();
  });

  it("drops an uncorroborated VENDOR_NAME and recovers the real name from the top OCR line", () => {
    const blocks = [
      { BlockType: "LINE", Text: "EXCHANGE", Confidence: 99 },
      { BlockType: "LINE", Text: "Ramstein KMCC Mall", Confidence: 98 },
      { BlockType: "LINE", Text: "TOTAL 40.45", Confidence: 99 },
    ];
    // "Gorl2x" passes shape checks but appears nowhere in the real OCR lines, so
    // it's dropped — and the corroborated top printed line is recovered instead.
    const bad = mapAnalyzeExpense(
      fakeOutput({ SummaryFields: [summaryField("VENDOR_NAME", "Gorl2x")], Blocks: blocks }),
    );
    expect(bad.fields.vendor).toBe("EXCHANGE");

    // Textract's own VENDOR_NAME wins when it IS corroborated (keeps its casing).
    const ok = mapAnalyzeExpense(
      fakeOutput({ SummaryFields: [summaryField("VENDOR_NAME", "Exchange")], Blocks: blocks }),
    );
    expect(ok.fields.vendor).toBe("Exchange");
  });

  it("stays blank when nothing plausible can be recovered", () => {
    const blocks = [
      { BlockType: "LINE", Text: "TOTAL 40.45", Confidence: 99 },
      { BlockType: "LINE", Text: "VISA ****1234", Confidence: 98 },
      { BlockType: "LINE", Text: "06/12/2024", Confidence: 97 },
    ];
    const r = mapAnalyzeExpense(
      fakeOutput({ SummaryFields: [summaryField("VENDOR_NAME", "gorl2")], Blocks: blocks }),
    );
    expect(r.fields.vendor).toBeUndefined();
  });

  it("does not let generic NAME overwrite VENDOR_NAME", () => {
    const r = mapAnalyzeExpense(
      fakeOutput({
        SummaryFields: [summaryField("VENDOR_NAME", "EXCHANGE"), summaryField("NAME", "William Carlon")],
      }),
    );
    expect(r.fields.vendor).toBe("EXCHANGE");
  });
});

describe("mapAnalyzeExpense — rawText from OCR blocks", () => {
  it("uses real OCR lines, drops low-confidence bleed-through, flags the source", () => {
    const r = mapAnalyzeExpense(
      fakeOutput({
        SummaryFields: [summaryField("TOTAL", "40.45")],
        Blocks: [
          { BlockType: "LINE", Text: "give back ot ytinummoc", Confidence: 55 },
          { BlockType: "LINE", Text: "EXCHANGE", Confidence: 99 },
          { BlockType: "LINE", Text: "Ramstein KMCC Mall", Confidence: 98 },
        ],
      }),
    );
    expect(r.rawText).toBe("EXCHANGE\nRamstein KMCC Mall");
    expect(r.rawTextSource).toBe("document");
  });

  it("falls back to the summary list (flagged) when no blocks exist", () => {
    const r = mapAnalyzeExpense(fakeOutput({ SummaryFields: [summaryField("TOTAL", "40.45")] }));
    expect(r.rawTextSource).toBe("summary");
    expect(r.rawText).toContain("TOTAL: 40.45");
  });
});

describe("mapAnalyzeExpense — line items", () => {
  function itemRow(fields: Record<string, string>) {
    return {
      LineItemExpenseFields: Object.entries(fields).map(([t, v]) => ({
        Type: { Text: t },
        ValueDetection: { Text: v },
      })),
    };
  }

  it("drops adjustment rows and strips the folded qty suffix", () => {
    const r = mapAnalyzeExpense(
      fakeOutput({
        LineItemGroups: [
          {
            LineItems: [
              itemRow({ ITEM: "TAC SLING PK, CB 014421091226 4 @ 22.46 =", QUANTITY: "4", UNIT_PRICE: "22.46" }),
              itemRow({ ITEM: "Trans Disc. YOUR REFUND" }),
              itemRow({ ITEM: "UNIT CHARGE (%10.00)" }),
              itemRow({ ITEM: "Some item", PRICE: "-4.50" }),
            ],
          },
        ],
      }),
    );
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0]).toMatchObject({
      description: "TAC SLING PK, CB 014421091226",
      quantity: "4",
      unitPrice: "22.46",
    });
  });

  it("keeps the SKU Textract reads off the row", () => {
    const r = mapAnalyzeExpense(
      fakeOutput({
        LineItemGroups: [{ LineItems: [itemRow({ ITEM: "TAC SLING PK", PRODUCT_CODE: "014421091226" })] }],
      }),
    );
    expect(r.lineItems[0].productCode).toBe("014421091226");
  });
});

describe("mapAnalyzeExpense — addresses", () => {
  // CITY/STATE/ZIP_CODE carry no owner in their type — only GroupProperties says
  // whether a value is the merchant's or the buyer's. Getting this backwards
  // would push the cardholder's own address as the merchant's.
  function grouped(type: string, value: string, group: string) {
    return { ...summaryField(type, value), GroupProperties: [{ Types: [group] }] };
  }

  it("routes vendor-grouped parts to the merchant and receiver-grouped to ship-to", () => {
    const r = mapAnalyzeExpense(
      fakeOutput({
        SummaryFields: [
          summaryField("VENDOR_ADDRESS", "Flugplatz 1"),
          grouped("CITY", "Ramstein", "VENDOR"),
          grouped("STATE", "RP", "VENDOR"),
          grouped("ZIP_CODE", "66877", "VENDOR"),
          grouped("CITY", "Kaiserslautern", "RECEIVER"),
          grouped("ZIP_CODE", "67657", "RECEIVER"),
        ],
      }),
    );
    expect(r.fields).toMatchObject({
      merchantAddress: "Flugplatz 1",
      merchantCity: "Ramstein",
      merchantState: "RP",
      merchantPostal: "66877",
      shipCity: "Kaiserslautern",
      shipPostal: "67657",
    });
  });

  it("leaves the merchant address alone when only the buyer's is on the document", () => {
    const r = mapAnalyzeExpense(
      fakeOutput({ SummaryFields: [grouped("ADDRESS", "Unit 3220 Box 15", "RECEIVER")] }),
    );
    expect(r.fields.merchantAddress).toBeUndefined();
  });
});
