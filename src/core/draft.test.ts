import { describe, expect, it } from "vitest";
import {
  checklistForDocType,
  draftFromResult,
  inferDocType,
  recordFromDraft,
  type RecordEdits,
  type ReviewDraft,
} from "./draft";
import { emptyChecklist, emptyMandatoryAuth } from "./types";
import type { ExtractionResult } from "./extraction/extractionService";

function result(over: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    fields: {},
    rawText: "",
    lineItems: [],
    source: "tesseract",
    ...over,
  };
}

const EDITS: RecordEdits = {
  vendor: "  The Exchange  ",
  transactionDate: " 03/14/2026 ",
  totalAmount: " 77.47 ",
  currency: "USD",
  taxAmount: "  ",
  cardLast4: "4421",
  receiptNumber: "",
  invoiceNumber: " ",
  notes: "ok",
  requestorName: " Jordan Reyes ",
  emergencyTypeOperation: "Not in support of ETO",
  designation889: "889 Government",
  specialPreApproval: "No Items Require Special Approvals",
  delegatedProcurementAuthority: "Micro-Purchase CH",
  prePurchaseApprovals: "None Required",
  section508Consideration: "No Item(s) in Order are Subject to 508 Requirement",
  requestToPurchaseReceived: "Written Request Provided",
  spendAnalysis: "Office Supplies",
  requiredSourceScreened: "Purchased from Required Source",
  finalDeliveryOutsideUs: "No",
  lineItemTax: "0.00",
  status: "needs_review",
  docType: "receipt",
  lineItems: [{ description: "Coffee", quantity: null, unitPrice: null, total: "49.99" }],
  mandatoryAuth: emptyMandatoryAuth(),
  attachments: [],
};

describe("inferDocType", () => {
  it("recognises the NATO SOFA VAT-relief form by title", () => {
    expect(inferDocType(result({ rawText: "ABWICKLUNGSSCHEIN ...", source: "pdf_text" }))).toBe("vat_form");
  });
  it("treats native-PDF invoices and quotes by keyword, defaulting to invoice", () => {
    expect(inferDocType(result({ source: "pdf_text", rawText: "INVOICE No 1" }))).toBe("invoice");
    expect(inferDocType(result({ source: "pdf_text", rawText: "QUOTATION" }))).toBe("quote");
    expect(inferDocType(result({ source: "pdf_text", rawText: "Better Direct" }))).toBe("invoice");
  });
  it("treats OCR'd images as receipts", () => {
    expect(inferDocType(result({ source: "tesseract", rawText: "TOTAL $5" }))).toBe("receipt");
  });
});

describe("checklistForDocType", () => {
  it("flags exactly the document the DocType implies", () => {
    expect(checklistForDocType("receipt")).toEqual({ ...emptyChecklist(), receiptUploaded: true });
    expect(checklistForDocType("invoice")).toEqual({ ...emptyChecklist(), invoiceUploaded: true });
    expect(checklistForDocType("quote")).toEqual({ ...emptyChecklist(), quoteUploaded: true });
    expect(checklistForDocType("vat_form")).toEqual({ ...emptyChecklist(), approvalDocUploaded: true });
    expect(checklistForDocType("other")).toEqual({ ...emptyChecklist(), otherDocsUploaded: true });
  });
});

describe("draftFromResult", () => {
  it("carries the extraction through and infers DocType when none is given", () => {
    const r = result({ rawText: "TOTAL $5", source: "tesseract", confidence: 0.9 });
    const d = draftFromResult(r, { imageUri: "u", imageBlob: null, captureStartedAt: 1000 });
    expect(d.source).toBe("tesseract");
    expect(d.confidence).toBe(0.9);
    expect(d.imageUri).toBe("u");
    expect(d.captureStartedAt).toBe(1000);
    expect(d.docType).toBe("receipt");
  });
  it("respects an explicit DocType override", () => {
    const d = draftFromResult(result({ source: "pdf_text", rawText: "INVOICE" }), {
      imageUri: "",
      imageBlob: null,
      captureStartedAt: 0,
      docType: "quote",
    });
    expect(d.docType).toBe("quote");
  });
});

describe("recordFromDraft", () => {
  const draft: ReviewDraft = {
    fields: {},
    rawText: "raw text",
    lineItems: [],
    source: "tesseract",
    imageUri: "img",
    imageBlob: null,
    docType: "receipt",
    captureStartedAt: 10_000,
    mandatoryAuth: emptyMandatoryAuth(),
  };

  it("trims fields and coerces blank nullable fields to null", () => {
    const rec = recordFromDraft(draft, EDITS, { id: "r1", finishedAt: 50_000, now: "2026-01-01T00:00:00.000Z" });
    expect(rec.vendor).toBe("The Exchange");
    expect(rec.totalAmount).toBe("77.47");
    expect(rec.taxAmount).toBeNull(); // whitespace-only -> null
    expect(rec.receiptNumber).toBeNull();
    expect(rec.invoiceNumber).toBeNull();
    expect(rec.cardLast4).toBe("4421");
  });

  it("measures capture seconds from the draft start to finishedAt", () => {
    const rec = recordFromDraft(draft, EDITS, { id: "r1", finishedAt: 50_000 });
    expect(rec.captureSeconds).toBe(40); // (50000 - 10000) / 1000
  });

  it("never reports negative capture time", () => {
    const rec = recordFromDraft(draft, EDITS, { id: "r1", finishedAt: 9_000 });
    expect(rec.captureSeconds).toBe(0);
  });

  it("derives the checklist from the edited DocType, not the draft's", () => {
    const rec = recordFromDraft(draft, { ...EDITS, docType: "invoice" }, { id: "r1", finishedAt: 20_000 });
    expect(rec.docType).toBe("invoice");
    expect(rec.documentChecklist.invoiceUploaded).toBe(true);
    expect(rec.documentChecklist.receiptUploaded).toBe(false);
  });

  it("carries the US Bank order fields, trimming the requestor and defaulting blank ETO", () => {
    const rec = recordFromDraft(draft, { ...EDITS, emergencyTypeOperation: "  " }, { id: "r1", finishedAt: 20_000 });
    expect(rec.requestorName).toBe("Jordan Reyes");
    expect(rec.emergencyTypeOperation).toBe("Not in support of ETO");

    const inSupport = recordFromDraft(draft, { ...EDITS, emergencyTypeOperation: "In Support of ETO" }, { id: "r1", finishedAt: 20_000 });
    expect(inSupport.emergencyTypeOperation).toBe("In Support of ETO");
  });

  it("carries source, rawText and id straight from the draft and context", () => {
    const rec = recordFromDraft(draft, EDITS, { id: "abc", finishedAt: 20_000 });
    expect(rec.id).toBe("abc");
    expect(rec.source).toBe("tesseract");
    expect(rec.rawOcrText).toBe("raw text");
  });
});
