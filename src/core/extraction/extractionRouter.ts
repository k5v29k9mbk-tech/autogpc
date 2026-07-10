// extractionRouter — picks the extraction source by input type. UI-free:
// screens call `routeExtraction()` and render whatever ExtractionResult comes
// back, labelled with its `source`.
//
//   native PDF (text layer)   -> pdf_text
//   scanned PDF (no text)     -> rasterize page 1 -> tesseract
//   image                     -> tesseract (+ preprocess)
//
// On failure it throws a message the Scan screen shows the user — it never
// fabricates a result. Faded thermal receipts and handwriting are the case
// for the `cloud` source (AWS Textract AnalyzeExpense) behind this same
// interface.

import {
  isImage,
  isPdf,
  type ExtractionInput,
  type ExtractionResult,
  type ProgressCallback,
} from "./extractionService";
import { pdfTextService } from "./pdfTextService";
import { tesseractService } from "./tesseractService";
import { cloudExtractionService } from "./cloudExtractionService";
import { renderPdfThumbnail } from "../../lib/pdfThumbnail";

// Opt-in cloud source (AWS Textract via /api/extract). Off by default so the
// SPA ships standalone; flip VITE_CLOUD_EXTRACTION=true once the function and
// AWS creds are deployed.
const CLOUD_ENABLED = import.meta.env.VITE_CLOUD_EXTRACTION === "true";

export async function routeExtraction(
  input: ExtractionInput,
  onProgress?: ProgressCallback,
): Promise<ExtractionResult> {
  if (!isPdf(input) && !isImage(input)) {
    throw new Error(
      `Unsupported file type: ${input.mimeType || "unknown"}. Upload a JPG, PNG, or PDF.`,
    );
  }

  // Cloud-first: Textract AnalyzeExpense reads documents by layout, so it
  // assigns fields (vendor / total / tax / line items) far more reliably than
  // the regex parser, which depends on text order and breaks across vendors.
  // Local extraction stays as an automatic fallback (offline, or if /api is
  // down) — and never fabricates data.
  if (CLOUD_ENABLED) {
    try {
      return await cloudExtractionService.extract(input, onProgress);
    } catch (cloudErr) {
      console.warn("[extraction] cloud failed, falling back to local:", cloudErr);
    }
  }

  if (isPdf(input)) {
    try {
      return await pdfTextService.extract(input, onProgress);
    } catch (err) {
      // pdfjs throws PasswordException for encrypted PDFs — OCR can't help.
      if (err instanceof Error && err.name === "PasswordException") {
        throw new Error("This PDF is password-protected. Remove the password and try again.");
      }
      // No text layer = a scan saved as PDF. Rasterize and OCR it like a photo.
      // Scale 4 (~300dpi on letter) — measurably better OCR than the preview's
      // scale 2 on real thermal-receipt scans.
      // ponytail: page 1 only — receipts are single-page; loop pages if
      // multi-page scanned invoices show up.
      const raster = await renderPdfThumbnail(input.blob, 4).catch(() => null);
      if (!raster) {
        throw new Error(
          "Couldn't read this PDF — it may be corrupted. Try re-exporting it or uploading a photo of the document instead.",
        );
      }
      try {
        return await tesseractService.extract(
          { blob: raster, mimeType: "image/png", fileName: input.fileName },
          onProgress,
        );
      } catch {
        throw new Error(
          "Couldn't read this scanned PDF. Try a clearer, better-lit photo of the document instead.",
        );
      }
    }
  }

  // image
  try {
    return await tesseractService.extract(input, onProgress);
  } catch {
    throw new Error("Couldn't read this image. Try a clearer, better-lit photo.");
  }
}
