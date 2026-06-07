// extractionRouter — picks the extraction source by input type. UI-free:
// screens call `routeExtraction()` and render whatever ExtractionResult comes
// back, labelled with its `source`.
//
//   native PDF (text layer) -> pdf_text
//   image                   -> tesseract (+ preprocess)
//
// On failure it throws a message the Scan screen shows the user — it never
// fabricates a result. A scanned PDF with no text layer is a Sprint-2
// rasterize-then-OCR item; faded thermal receipts and handwriting are the case
// for the future `cloud` source (AWS Textract AnalyzeExpense) behind this same
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
    } catch {
      throw new Error(
        "This PDF has no readable text layer — it looks like a scan. Try uploading a photo of the document instead.",
      );
    }
  }

  // image
  try {
    return await tesseractService.extract(input, onProgress);
  } catch {
    throw new Error("Couldn't read this image. Try a clearer, better-lit photo.");
  }
}
