import { describe, expect, it } from "vitest";
import { summaryDocument, utf8ToBase64 } from "./usbankDocuments";
import { emptyChecklist, type PurchaseRecord } from "../core/types";

function record(over: Partial<PurchaseRecord> = {}): PurchaseRecord {
  return {
    id: "r1",
    vendor: "CAFÉ MÜNCHEN",
    transactionDate: "2026-05-02",
    totalAmount: "12.00",
    currency: "EUR",
    taxAmount: null,
    cardLast4: null,
    receiptNumber: null,
    invoiceNumber: null,
    lineItems: [],
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

describe("summaryDocument", () => {
  it("base64 decodes back to the structured text, including a non-Latin1 vendor", () => {
    const doc = summaryDocument(record());
    const decoded = Buffer.from(doc.dataBase64, "base64").toString("utf8");
    expect(decoded).toContain("CAFÉ MÜNCHEN");
    expect(doc.contentType).toBe("text/plain");
    expect(doc.filename).toBe("autogpc-summary-r1.txt");
  });
});

describe("utf8ToBase64", () => {
  it("round-trips unicode that plain btoa would throw on", () => {
    expect(Buffer.from(utf8ToBase64("Café €"), "base64").toString("utf8")).toBe("Café €");
  });
});
