// pdfTextService against real PDFs, generated in-test with jspdf (already a
// dependency). Covers: text-layer extraction end-to-end into parsed fields,
// multi-page reading order, and the no-text-layer (scan) rejection.

import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { jsPDF } from "jspdf";
import { GlobalWorkerOptions } from "pdfjs-dist";
import { pdfTextService, NoTextLayerError } from "./pdfTextService";
import type { ExtractionInput } from "./extractionService";

// The service's `?url` worker import resolves to a dev-server path that node
// can't load; point pdfjs at the real file on disk for the node test run.
GlobalWorkerOptions.workerSrc = createRequire(import.meta.url).resolve(
  "pdfjs-dist/build/pdf.worker.min.mjs",
);

function pdfInput(build: (doc: jsPDF) => void): ExtractionInput {
  const doc = new jsPDF();
  build(doc);
  const blob = new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
  return { blob, mimeType: "application/pdf", fileName: "test.pdf" };
}

describe("pdfTextService", () => {
  it("extracts fields from a text-layer receipt PDF", async () => {
    const input = pdfInput((doc) => {
      doc.text("BETTER DIRECT LLC", 20, 20);
      doc.text("Invoice #: INV-20260315", 20, 30);
      doc.text("Date: 03/15/2026", 20, 40);
      doc.text("Subtotal $40.00", 20, 50);
      doc.text("Sales Tax $3.20", 20, 60);
      doc.text("TOTAL $43.20", 20, 70);
      doc.text("VISA **** 4421", 20, 80);
    });

    const result = await pdfTextService.extract(input);

    expect(result.source).toBe("pdf_text");
    expect(result.rawText).toContain("BETTER DIRECT LLC");
    expect(result.fields.vendor).toBe("BETTER DIRECT LLC");
    expect(result.fields.totalAmount).toBe("43.20");
    expect(result.fields.taxAmount).toBe("3.20");
    expect(result.fields.transactionDate).toBe("03/15/2026");
    expect(result.fields.currency).toBe("USD");
    expect(result.fields.cardLast4).toBe("4421");
    expect(result.fields.invoiceNumber).toBe("INV-20260315");
  });

  it("reads all pages in order", async () => {
    const input = pdfInput((doc) => {
      doc.text("PAGE ONE VENDOR INC", 20, 20);
      doc.addPage();
      doc.text("TOTAL $99.95", 20, 20);
    });

    const result = await pdfTextService.extract(input);

    expect(result.rawText.indexOf("PAGE ONE VENDOR INC")).toBeGreaterThanOrEqual(0);
    expect(result.rawText.indexOf("PAGE ONE VENDOR INC")).toBeLessThan(
      result.rawText.indexOf("TOTAL $99.95"),
    );
    expect(result.fields.totalAmount).toBe("99.95");
  });

  it("rejects a PDF with no usable text layer (scan saved as PDF)", async () => {
    // A blank page has a valid PDF structure but no text — same as a scan.
    const input = pdfInput(() => {});
    await expect(pdfTextService.extract(input)).rejects.toBeInstanceOf(NoTextLayerError);
  });

  it("rejects garbage bytes that aren't a PDF", async () => {
    const input: ExtractionInput = {
      blob: new Blob(["not a pdf at all"], { type: "application/pdf" }),
      mimeType: "application/pdf",
      fileName: "broken.pdf",
    };
    await expect(pdfTextService.extract(input)).rejects.toThrow();
  });
});
