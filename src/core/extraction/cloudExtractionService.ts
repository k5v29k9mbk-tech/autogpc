// cloudExtractionService — client TRANSPORT adapter for the cloud OCR path.
//
// It holds NO credentials. It compresses the document, POSTs it to the
// serverless function at /api/extract (which carries the AWS key and calls
// Textract AnalyzeExpense), and hands the JSON to mergeCloudExtraction — the
// merge policy itself is a pure function in resultFromText.ts, not here.
// The UI keeps calling extract() through the same ExtractionService seam and is
// none the wiser about which engine ran.
//
// NOTE: compressForUpload uses the canvas, so this adapter is web-specific (like
// preprocessImage). A future iOS shell would supply its own implementation
// behind this same interface.

import { mergeCloudExtraction, type CloudPayload } from "./resultFromText";
import {
  isImage,
  isPdf,
  type ExtractionInput,
  type ExtractionResult,
  type ExtractionService,
  type ProgressCallback,
} from "./extractionService";
import { renderPdfThumbnail } from "../../lib/pdfThumbnail";

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
    // JPEG has no alpha — without this, transparent PNG regions turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return out ?? blob;
  } catch {
    return blob;
  }
}

export const cloudExtractionService: ExtractionService = {
  name: "cloud",
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
    const cloud = (await res.json()) as CloudPayload;

    onProgress?.({ stage: "parsing", progress: 1 });

    return mergeCloudExtraction(cloud);
  },
};
