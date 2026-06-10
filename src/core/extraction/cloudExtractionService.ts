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
import { renderPdfThumbnail } from "../../lib/pdfThumbnail";
import type { LineItem, PurchaseRecord } from "../types";

/** Shape the /api/extract function returns (source is attached client-side). */
type CloudResponse = {
  fields: Partial<PurchaseRecord>;
  rawText: string;
  /** "document" = real OCR lines in reading order; "summary" = synthetic "TYPE: value" list. */
  rawTextSource?: "document" | "summary";
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

    // Always send Textract an image: compress photos, and rasterize page 1 of a
    // (scanned) PDF to a JPEG so it reads well and the upload stays small. Fall
    // back to raw single-page PDF bytes only if rasterizing fails.
    let toSend = input.blob;
    let mimeType = input.mimeType || "application/octet-stream";
    if (isImage(input)) {
      toSend = await compressForUpload(input.blob);
      mimeType = "image/jpeg";
    } else if (isPdf(input)) {
      const raster = await renderPdfThumbnail(input.blob, 2);
      if (raster) {
        toSend = await compressForUpload(raster);
        mimeType = "image/jpeg";
      } else {
        mimeType = "application/pdf";
      }
    }

    const fileBase64 = await blobToBase64(toSend);

    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileBase64, mimeType }),
    });
    if (!res.ok) {
      if (res.status === 404) {
        // The serverless function isn't being served — almost always plain
        // `vite dev` (which doesn't run /api). Use `vercel dev` or the deployed
        // site to exercise the cloud path.
        throw new Error(
          "cloud: /api/extract returned 404 — the serverless function isn't running (use `vercel dev` or the deployed site).",
        );
      }
      const detail = await res.text().catch(() => "");
      throw new Error(`cloud: /api/extract failed (${res.status}) ${detail}`.trim());
    }
    const cloud = (await res.json()) as CloudResponse;

    onProgress?.({ stage: "parsing", progress: 1 });

    // parseReceipt as a fallback: cloud-detected fields win, regex fills gaps.
    // Exception: the vendor heuristic assumes the storefront name is the top
    // printed line, which only holds when rawText is the document's real OCR
    // lines. On the synthetic "TYPE: value" summary fallback the first line is
    // arbitrary (e.g. "AMOUNT_PAID: 555.65") — leave vendor blank for review
    // rather than filling it with a wrong guess.
    const base = resultFromText(cloud.rawText, "cloud", cloud.confidence);
    if (cloud.rawTextSource !== "document") base.fields.vendor = "";
    const fields = { ...base.fields, ...nonEmpty(cloud.fields) };
    const lineItems = cloud.lineItems?.length ? cloud.lineItems : base.lineItems;

    return { fields, rawText: cloud.rawText, lineItems, source: "cloud", confidence: cloud.confidence };
  },
};
