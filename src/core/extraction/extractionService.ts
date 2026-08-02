// The extraction abstraction — the seam that makes the engine swappable.
//
// Every extraction source (pdf-text, Tesseract, and the cloud extractor)
// implements this one interface, so the UI never knows or cares which engine
// produced a result. The cloud source drops in behind the same `extract()`
// signature without touching a single screen.
//
// UI-free and platform-agnostic on purpose.

import type { ExtractionSource, LineItem, PurchaseRecord } from "../types";

/** Bytes + a hint of what they are. A `File` satisfies this on the web. */
export type ExtractionInput = {
  blob: Blob;
  mimeType: string;
  fileName?: string;
};

export type ExtractionStage =
  | "loading"
  | "preprocessing"
  | "recognizing"
  | "parsing";

export type ExtractionProgress = {
  stage: ExtractionStage;
  /** 0..1 within the current stage where the engine exposes it (Tesseract does). */
  progress: number;
  message?: string;
};

export type ProgressCallback = (p: ExtractionProgress) => void;

export type ExtractionResult = {
  fields: Partial<PurchaseRecord>;
  rawText: string;
  lineItems: LineItem[];
  source: ExtractionSource;
  /**
   * 0..1, bucketed for display (lib/format confidenceBucket). Semantics by
   * engine: pdf_text = 1 (exact text layer), tesseract = OCR character
   * confidence, cloud = mean of Textract field confidences + the vendor
   * post-processor score.
   */
  confidence?: number;
};

export interface ExtractionService {
  /** Human-readable name for diagnostics / the source tag. */
  readonly name: ExtractionSource;
  extract(input: ExtractionInput, onProgress?: ProgressCallback): Promise<ExtractionResult>;
}

export function isPdf(input: ExtractionInput): boolean {
  return (
    input.mimeType === "application/pdf" ||
    (input.fileName?.toLowerCase().endsWith(".pdf") ?? false)
  );
}

export function isImage(input: ExtractionInput): boolean {
  return input.mimeType.startsWith("image/");
}
