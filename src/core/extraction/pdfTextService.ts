// pdfTextService — extracts a native PDF's text layer directly. No OCR.
//
// A large share of real GPC supporting docs are vendor-emailed PDFs that
// already carry a perfect text layer (Better Direct, SHG, United Office
// Solutions, Yellow Networks). For those this is free, instant and exact, so
// the router always prefers it when a text layer exists.
//
// Worker note: importing the worker with Vite's `?url` suffix guarantees the
// worker file matches the installed pdfjs-dist version in both `dev` and the
// production build — the single most common pdfjs-on-Vite gotcha.

import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  isPdf,
  type ExtractionInput,
  type ExtractionResult,
  type ExtractionService,
  type ProgressCallback,
} from "./extractionService";
import { resultFromText } from "./resultFromText";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Below this many characters we treat the PDF as "no real text layer"
// (i.e. a scan saved as PDF) and let the router fall back.
const MIN_TEXT_LAYER_CHARS = 24;

export class NoTextLayerError extends Error {
  constructor() {
    super("PDF has no usable text layer");
    this.name = "NoTextLayerError";
  }
}

async function extractPdfText(buffer: ArrayBuffer, onProgress?: ProgressCallback): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    onProgress?.({
      stage: "loading",
      progress: pageNum / doc.numPages,
      message: `Reading page ${pageNum} of ${doc.numPages}`,
    });
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    let current = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      current += item.str;
      if (item.hasEOL) {
        lines.push(current);
        current = "";
      } else {
        current += " ";
      }
    }
    if (current.trim()) lines.push(current);
    lines.push(""); // page break
  }

  await doc.destroy();
  return lines.join("\n").replace(/[ \t]+\n/g, "\n").trim();
}

export const pdfTextService: ExtractionService = {
  name: "pdf_text",

  canHandle: isPdf,

  async extract(input: ExtractionInput, onProgress?: ProgressCallback): Promise<ExtractionResult> {
    const buffer = await input.blob.arrayBuffer();
    const rawText = await extractPdfText(buffer, onProgress);
    if (rawText.replace(/\s/g, "").length < MIN_TEXT_LAYER_CHARS) {
      throw new NoTextLayerError();
    }
    onProgress?.({ stage: "parsing", progress: 1, message: "Structuring fields" });
    return resultFromText(rawText, "pdf_text", 1);
  },
};
