// cloudExtractionService — INTERFACE STUB ONLY. Not implemented in Sprint 1.
//
// This file exists to prove the seam: a cloud extractor slots in behind the
// exact same ExtractionService interface the UI already calls, so swapping it
// in later touches zero screen code.
//
// ── Sprint 2 plan (do NOT build now) ────────────────────────────────────────
// When accuracy needs to jump — especially for faded thermal receipts and the
// handwritten NATO SOFA VAT-relief forms — implement this against a serverless
// function at `/api/extract`:
//
//   client ──ExtractionService.extract()──▶ /api/extract (Vercel function)
//                                              │ holds the provider key in
//                                              │ Vercel env vars; the browser
//                                              ▼ never sees a secret
//                                           AWS Textract  AnalyzeExpense
//
// Lead option: AWS Textract `AnalyzeExpense`.
//   • Purpose-built for receipts/invoices; returns normalized vendor / total /
//     tax / date plus line items, so it can populate `fields` directly and the
//     regex parser (parseReceipt) becomes a fallback rather than the primary.
//   • Handles handwriting far better than open-source OCR.
//   • Decisive for a government tool: FedRAMP High in AWS GovCloud and a DoD
//     Impact Level path.
// A vision LLM is the more flexible alternative but has a weaker compliance
// story for real PII, so Textract leads.
//
// The function — not the client — would carry the key; the client keeps calling
// `extract()` and is none the wiser. See README "Upgrade path".

import {
  type ExtractionInput,
  type ExtractionResult,
  type ExtractionService,
} from "./extractionService";

export const cloudExtractionService: ExtractionService = {
  name: "cloud",
  canHandle: () => false, // disabled in Sprint 1
  async extract(_input: ExtractionInput): Promise<ExtractionResult> {
    throw new Error(
      "cloudExtractionService is not implemented in Sprint 1. " +
        "See the file header for the AWS Textract AnalyzeExpense upgrade plan.",
    );
  },
};
