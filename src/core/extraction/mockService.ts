// mockService — instant canned results.
//
// Two jobs:
//   1. It is the final fallback in the router so a demo never dead-ends, even
//      offline or when a real engine throws.
//   2. It owns the scrubbed raw text for the four seeded sample documents, so
//      sampleData.ts has a single source of truth (no real PII anywhere).
//
// All values here are synthetic — no real names, .mil emails, CAGE codes, or
// card numbers.

import type { PurchaseRecord } from "../types";
import {
  type ExtractionInput,
  type ExtractionResult,
  type ExtractionService,
  type ProgressCallback,
} from "./extractionService";
import { resultFromText } from "./resultFromText";

export type MockSampleKey = "thermal_us" | "german_vat" | "vendor_quote" | "vat_form";

export const MOCK_RAW_TEXT: Record<MockSampleKey, string> = {
  thermal_us: [
    "THE EXCHANGE",
    "Ramstein Main Store",
    "Bldg 2113, Ramstein AB",
    "-----------------------------",
    "Cashier 14   Reg 07",
    "Date 03/14/2026  10:42",
    "Trans #88241007",
    "",
    "Coffee Maker 12c        49.99",
    "USB-C Cable 2m          12.49",
    "Travel Mug              14.99",
    "-----------------------------",
    "Subtotal                77.47",
    "Sales Tax                0.00",
    "TOTAL                  $77.47",
    "MASTERCARD ************4421",
    "AUTH 002914",
    "Items Sold 3",
    "Thank you for shopping",
  ].join("\n"),

  german_vat: [
    "toom Baumarkt GmbH",
    "Merkurstr. 14, 67663 Kaiserslautern",
    "Datum 22.04.2026  14:08",
    "Beleg-Nr 5567-22",
    "",
    "Schrauben-Set        1     8,99",
    "Akkuschrauber        1    79,00",
    "Malervlies 25m       2    15,50   31,00",
    "-----------------------------",
    "Zwischensumme            118,99",
    "MwSt 19%                  22,61",
    "Gesamt                   141,60 €",
    "EC-Karte ********8890",
    "Vielen Dank fuer Ihren Einkauf",
  ].join("\n"),

  vendor_quote: [
    "Better Direct LLC",
    "1450 Corporate Way, Suite 200, Reston VA",
    "quotes@betterdirect.example",
    "",
    "QUOTATION",
    "Quote No: Q-2026-0455",
    "Date: 2026-05-02",
    "Valid for 30 days",
    "",
    "Item                        Qty    Unit       Ext",
    "Rugged Laptop Case 15in      4     89.00    356.00",
    "USB-C Docking Station        2    210.00    420.00",
    "Cat6 Patch Cable 3ft        10      6.50     65.00",
    "                                   Subtotal 841.00",
    "                                   TOTAL   $841.00",
    "889 compliant: Yes",
  ].join("\n"),

  // Handwriting / forms read poorly with open-source OCR, so this sample is
  // backed by mock text and explicit fields (see MOCK_EXPLICIT below).
  vat_form: [
    "ABWICKLUNGSSCHEIN",
    "(VAT relief form - NATO SOFA)",
    "Auftragsnummer: AS-2026-1182",
    "Datum: 18.05.2026",
    "Lieferant: Elektro Hofmann GmbH",
    "Leistung: Elektroinstallation Buero",
    "Nettobetrag: 1.250,00 EUR",
    "USt befreit gem. NATO-Truppenstatut",
    "Gesamt: 1.250,00 EUR",
  ].join("\n"),
};

// For the handwritten form we trust explicit fields over the regex parser.
export const MOCK_EXPLICIT: Partial<Record<MockSampleKey, Partial<PurchaseRecord>>> = {
  vat_form: {
    vendor: "Elektro Hofmann GmbH",
    transactionDate: "18.05.2026",
    totalAmount: "1250.00",
    currency: "EUR",
    taxAmount: null,
    invoiceNumber: "AS-2026-1182",
    notes: "VAT-exempt under NATO SOFA. Handwriting was corrected on review.",
  },
};

function pickKey(input: ExtractionInput): MockSampleKey {
  const hint = (input.fileName ?? "").toLowerCase();
  if (hint.includes("quote") || input.mimeType === "application/pdf") return "vendor_quote";
  if (hint.includes("vat") || hint.includes("sofa") || hint.includes("abwick")) return "vat_form";
  if (hint.includes("toom") || hint.includes("german") || hint.includes("eur")) return "german_vat";
  return "thermal_us";
}

export function buildMockResult(key: MockSampleKey): ExtractionResult {
  const base = resultFromText(MOCK_RAW_TEXT[key], "mock", 0.5);
  const explicit = MOCK_EXPLICIT[key];
  if (explicit) {
    return { ...base, fields: { ...base.fields, ...explicit } };
  }
  return base;
}

export const mockService: ExtractionService = {
  name: "mock",
  canHandle: () => true, // always available as a last resort
  async extract(input: ExtractionInput, onProgress?: ProgressCallback): Promise<ExtractionResult> {
    onProgress?.({ stage: "parsing", progress: 1, message: "Using sample data" });
    return buildMockResult(pickKey(input));
  },
};
