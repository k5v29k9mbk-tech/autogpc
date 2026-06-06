// Render page 1 of a PDF to a PNG blob, so native-PDF uploads get a real
// preview and a stored thumbnail (an <img> can't display a PDF directly).
// Web-only (uses canvas); kept out of core for that reason.

import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function renderPdfThumbnail(blob: Blob, scale = 1.5): Promise<Blob | null> {
  const buffer = await blob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    await doc.destroy();
    return null;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  await doc.destroy();

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
