// cloudExtractionService — client adapter for the cloud OCR path.
//
// It holds NO credentials. It compresses the document, POSTs it to the
// serverless function at /api/extract (which carries the AWS key and calls
// Textract AnalyzeExpense), and maps the JSON back into an ExtractionResult.
// The UI keeps calling extract() through the same ExtractionService seam and is
// none the wiser about which engine ran.
//
// Cloud fields win; the regex parser (parseReceipt, via resultFromText) fills
// any gaps — so a partial cloud response still produces a complete draft.
//
// NOTE: compressForUpload uses the canvas, so this adapter is web-specific (like
// preprocessImage). A future iOS shell would supply its own implementation
// behind this same interface.

import { resultFromText } from "./resultFromText";
import {
  isImage,
  isPdf,
  type ExtractionInput,
  type ExtractionResult,
  type ExtractionService,
  type ProgressCallback,
} from "./extractionService";
import type { LineItem, PurchaseRecord } from "../types";

/** Shape the /api/extract function returns (source is attached client-side). */
type CloudResponse = {
  fields: Partial<PurchaseRecord>;
  rawText: string;
  lineItems: LineItem[];
  confidence?: number;
};

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000; // avoid arg-count limits on fromCharCode
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Downscale + JPEG-compress an image so the upload stays under the serverless
 * body limit (~4.5 MB on Vercel). Best-effort: returns the original on failure.
 */
async function compressForUpload(blob: Blob, maxEdge = 2000, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return out ?? blob;
  } catch {
    return blob;
  }
}

/** Keep only fields that carry information, so they override regex gaps but blanks don't. */
function nonEmpty(fields: Partial<PurchaseRecord>): Partial<PurchaseRecord> {
  const out: Partial<PurchaseRecord> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== "" && value !== undefined) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

export const cloudExtractionService: ExtractionService = {
  name: "cloud",
  canHandle: (input) => isImage(input) || isPdf(input),
  async extract(input: ExtractionInput, onProgress?: ProgressCallback): Promise<ExtractionResult> {
    onProgress?.({ stage: "recognizing", progress: 0.2, message: "Cloud extraction" });

    const asImage = isImage(input);
    const toSend = asImage ? await compressForUpload(input.blob) : input.blob;
    const fileBase64 = await blobToBase64(toSend);
    const mimeType = asImage ? "image/jpeg" : input.mimeType || "application/pdf";

    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileBase64, mimeType }),
    });
    if (!res.ok) throw new Error(`Cloud extraction failed (${res.status})`);
    const cloud = (await res.json()) as CloudResponse;

    onProgress?.({ stage: "parsing", progress: 1 });

    // parseReceipt as a fallback: cloud-detected fields win, regex fills gaps.
    const base = resultFromText(cloud.rawText, "cloud", cloud.confidence);
    const fields = { ...base.fields, ...nonEmpty(cloud.fields) };
    const lineItems = cloud.lineItems?.length ? cloud.lineItems : base.lineItems;

    return { fields, rawText: cloud.rawText, lineItems, source: "cloud", confidence: cloud.confidence };
  },
};
