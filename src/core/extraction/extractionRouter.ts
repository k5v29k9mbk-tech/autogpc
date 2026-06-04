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
  if (isPdf(input)) {
    try {
      return await pdfTextService.extract(input, onProgress);
    } catch {
      // Scanned PDF (no text layer): the cloud source can OCR it if enabled.
      if (CLOUD_ENABLED) {
        try {
          return await cloudExtractionService.extract(input, onProgress);
        } catch {
          /* fall through to the message below */
        }
      }
      throw new Error(
        "This PDF has no readable text layer — it looks like a scan. Try uploading a photo of the document instead.",
      );
    }
  }

  if (isImage(input)) {
    // Prefer the cloud source for images when enabled; degrade to local OCR
    // (never to fabricated data) if it fails.
    if (CLOUD_ENABLED) {
      try {
        return await cloudExtractionService.extract(input, onProgress);
      } catch {
        /* fall back to in-browser Tesseract */
      }
    }
    try {
      return await tesseractService.extract(input, onProgress);
    } catch {
      throw new Error("Couldn't read this image. Try a clearer, better-lit photo.");
    }
  }

  throw new Error(
    `Unsupported file type: ${input.mimeType || "unknown"}. Upload a JPG, PNG, or PDF.`,
  );
}
