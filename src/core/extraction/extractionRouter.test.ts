// Routing logic only — every engine is mocked. The real engines are covered
// by pdfTextService.test.ts (real PDFs) and the api/ tests (Textract mapping).

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtractionResult } from "./extractionService";
import { NoTextLayerError } from "./pdfTextService";

const result = (source: string): ExtractionResult => ({
  fields: {},
  rawText: "x",
  lineItems: [],
  source: source as ExtractionResult["source"],
});

const { pdfExtract, tessExtract, renderThumb } = vi.hoisted(() => ({
  pdfExtract: vi.fn(),
  tessExtract: vi.fn(),
  renderThumb: vi.fn(),
}));

vi.mock("./pdfTextService", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./pdfTextService")>();
  return { NoTextLayerError: mod.NoTextLayerError, pdfTextService: { name: "pdf_text", canHandle: () => true, extract: pdfExtract } };
});
vi.mock("./tesseractService", () => ({
  tesseractService: { name: "tesseract", canHandle: () => true, extract: tessExtract },
}));
// Cloud rejects so the router always exercises the local paths, regardless of
// whether VITE_CLOUD_EXTRACTION leaked in from .env.local.
vi.mock("./cloudExtractionService", () => ({
  cloudExtractionService: {
    name: "cloud",
    canHandle: () => true,
    extract: vi.fn().mockRejectedValue(new Error("no cloud in tests")),
  },
}));
vi.mock("../../lib/pdfThumbnail", () => ({ renderPdfThumbnail: renderThumb }));

import { routeExtraction } from "./extractionRouter";

const pdfInput = { blob: new Blob(["%PDF"]), mimeType: "application/pdf", fileName: "r.pdf" };
const imgInput = { blob: new Blob(["img"]), mimeType: "image/jpeg", fileName: "r.jpg" };

beforeEach(() => {
  pdfExtract.mockReset();
  tessExtract.mockReset();
  renderThumb.mockReset();
});

describe("routeExtraction", () => {
  it("rejects unsupported file types with a helpful message", async () => {
    await expect(
      routeExtraction({ blob: new Blob(["x"]), mimeType: "text/plain", fileName: "notes.txt" }),
    ).rejects.toThrow(/Unsupported file type.*JPG, PNG, or PDF/);
  });

  it("routes images to tesseract", async () => {
    tessExtract.mockResolvedValue(result("tesseract"));
    const r = await routeExtraction(imgInput);
    expect(r.source).toBe("tesseract");
    expect(tessExtract).toHaveBeenCalledWith(imgInput, undefined);
  });

  it("routes text-layer PDFs to pdf_text", async () => {
    pdfExtract.mockResolvedValue(result("pdf_text"));
    const r = await routeExtraction(pdfInput);
    expect(r.source).toBe("pdf_text");
    expect(tessExtract).not.toHaveBeenCalled();
  });

  it("falls back to rasterize + OCR for scanned PDFs with no text layer", async () => {
    pdfExtract.mockRejectedValue(new NoTextLayerError());
    const raster = new Blob(["png"], { type: "image/png" });
    renderThumb.mockResolvedValue(raster);
    tessExtract.mockResolvedValue(result("tesseract"));

    const r = await routeExtraction(pdfInput);

    expect(r.source).toBe("tesseract");
    expect(renderThumb).toHaveBeenCalledWith(pdfInput.blob, 2);
    expect(tessExtract).toHaveBeenCalledWith(
      { blob: raster, mimeType: "image/png", fileName: "r.pdf" },
      undefined,
    );
  });

  it("names password protection when the PDF is encrypted", async () => {
    const err = new Error("No password given");
    err.name = "PasswordException";
    pdfExtract.mockRejectedValue(err);
    await expect(routeExtraction(pdfInput)).rejects.toThrow(/password-protected/);
    expect(renderThumb).not.toHaveBeenCalled();
  });

  it("reports a corrupted PDF when it can't be rasterized either", async () => {
    pdfExtract.mockRejectedValue(new NoTextLayerError());
    renderThumb.mockRejectedValue(new Error("bad xref"));
    await expect(routeExtraction(pdfInput)).rejects.toThrow(/may be corrupted/);
  });

  it("reports an unreadable scan when OCR on the rasterized page fails", async () => {
    pdfExtract.mockRejectedValue(new NoTextLayerError());
    renderThumb.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    tessExtract.mockRejectedValue(new Error("tesseract choked"));
    await expect(routeExtraction(pdfInput)).rejects.toThrow(/scanned PDF/);
  });

  it("shows the image-specific message when OCR fails on an image", async () => {
    tessExtract.mockRejectedValue(new Error("tesseract choked"));
    await expect(routeExtraction(imgInput)).rejects.toThrow(/clearer, better-lit photo/);
  });
});
