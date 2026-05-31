// extractionRouter — picks the right engine by input type and degrades
// gracefully. UI-free: screens call `routeExtraction()` and render whatever
// ExtractionResult comes back, labelled with its `source`.
//
// Default order:
//   native PDF (text layer) -> pdf_text
//   image                   -> tesseract (+ preprocess)
//   anything that fails     -> mock
//
// A scanned PDF with no text layer falls through to mock in Sprint 1;
// rasterizing such a PDF and running OCR on it is a noted Sprint 2 improvement.

import {
  isImage,
  isPdf,
  type ExtractionInput,
  type ExtractionResult,
  type ProgressCallback,
} from "./extractionService";
import { pdfTextService } from "./pdfTextService";
import { tesseractService } from "./tesseractService";
import { mockService } from "./mockService";

export type RouteOptions = {
  /** Disable the mock fallback (used by tests that want a hard failure). */
  allowMockFallback?: boolean;
};

export async function routeExtraction(
  input: ExtractionInput,
  onProgress?: ProgressCallback,
  options: RouteOptions = {},
): Promise<ExtractionResult> {
  const allowMock = options.allowMockFallback ?? true;

  if (isPdf(input)) {
    try {
      return await pdfTextService.extract(input, onProgress);
    } catch (err) {
      // No text layer (scanned PDF) or a parse failure — fall back.
      if (!allowMock) throw err;
      return mockService.extract(input, onProgress);
    }
  }

  if (isImage(input)) {
    try {
      return await tesseractService.extract(input, onProgress);
    } catch (err) {
      if (!allowMock) throw err;
      return mockService.extract(input, onProgress);
    }
  }

  // Unknown type.
  if (!allowMock) {
    throw new Error(`Unsupported input type: ${input.mimeType || "unknown"}`);
  }
  return mockService.extract(input, onProgress);
}
