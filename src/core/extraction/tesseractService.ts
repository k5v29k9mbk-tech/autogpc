// tesseractService — the primary OCR path for images in Sprint 1.
//
// Runs Tesseract.js entirely in the browser (WebAssembly), preceded by the
// canvas preprocessing pass that is the biggest quality lever for faded thermal
// receipts. English + German traineddata covers the AAFES and toom cases.
//
// The worker, wasm core and traineddata are fetched from a CDN on first use and
// cached by the browser thereafter. The DOCUMENT itself never leaves the
// device — only the open-source OCR model is downloaded.

import { createWorker } from "tesseract.js";
import { preprocessImage } from "../preprocessImage";
import {
  isImage,
  type ExtractionInput,
  type ExtractionResult,
  type ExtractionService,
  type ProgressCallback,
} from "./extractionService";
import { resultFromText } from "./resultFromText";

const LANGS = "eng+deu";

export const tesseractService: ExtractionService = {
  name: "tesseract",

  canHandle: isImage,

  async extract(input: ExtractionInput, onProgress?: ProgressCallback): Promise<ExtractionResult> {
    onProgress?.({ stage: "preprocessing", progress: 0, message: "Cleaning up the image" });
    const canvas = await preprocessImage(input.blob);

    const worker = await createWorker(LANGS, 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          onProgress?.({ stage: "recognizing", progress: m.progress, message: "Reading text…" });
        } else {
          onProgress?.({
            stage: "loading",
            progress: m.progress ?? 0,
            message: "Loading OCR engine",
          });
        }
      },
    });

    try {
      const { data } = await worker.recognize(canvas);
      onProgress?.({ stage: "parsing", progress: 1, message: "Structuring fields" });
      const confidence =
        typeof data.confidence === "number" ? data.confidence / 100 : undefined;
      return resultFromText(data.text, "tesseract", confidence);
    } finally {
      await worker.terminate();
    }
  },
};
