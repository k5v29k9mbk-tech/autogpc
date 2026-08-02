import { describe, expect, it } from "vitest";
import {
  checklistForDocType,
  draftFromResult,
  inferDocType,
  missingRequired,
  recordFromDraft,
  seedEdits,
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
  section889: null,
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
    const d = draftFromResult(r, { imageUri: "u", imageBlob: null });
    expect(d.source).toBe("tesseract");
    expect(d.confidence).toBe(0.9);
    expect(d.imageUri).toBe("u");
    expect(d.docType).toBe("receipt");
  });
  it("respects an explicit DocType override", () => {
    const d = draftFromResult(result({ source: "pdf_text", rawText: "INVOICE" }), {
      imageUri: "",
      imageBlob: null,
      docType: "quote",
    });
    expect(d.docType).toBe("quote");
  });
});

describe("seedEdits", () => {
  it("seeds the GPC defaults with no draft at all", () => {
    const e = seedEdits(null, { cardholderName: "Jordan Reyes", dutyStationOconus: true });
    expect(e.currency).toBe("USD");
    expect(e.taxAmount).toBe("0.00");
    expect(e.lineItemTax).toBe("0.00");
    expect(e.requestorName).toBe("Jordan Reyes");
    expect(e.emergencyTypeOperation).toBe("Not in support of ETO");
    expect(e.finalDeliveryOutsideUs).toBe("Yes-Via Postal Service to APO/FPO");
    expect(e.specialPreApproval).toBe("No Items Require Special Approvals");
    // Item-dependent menus stay blank — the reviewer must pick.
    expect(e.spendAnalysis).toBe("");
    expect(e.requiredSourceScreened).toBe("");
    expect(e.status).toBe("needs_review");
    expect(e.section889).toBeNull();
    // No parseable date -> today, as ISO for the date picker.
    expect(e.transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("normalizes the extracted date and keeps extracted fields", () => {
    const d = draftFromResult(
      result({ fields: { vendor: "toom", transactionDate: "22.04.2026", totalAmount: "12,99" } }),
      { imageUri: "", imageBlob: null },
    );
    const e = seedEdits(d);
    expect(e.vendor).toBe("toom");
    expect(e.transactionDate).toBe("2026-04-22");
    expect(e.totalAmount).toBe("12,99");
    expect(e.requestorName).toBe("");
  });
});

describe("missingRequired", () => {
  it("passes a fully answered form", () => {
    expect(missingRequired(EDITS)).toEqual([]);
  });
  it("names each blank red-asterisk field", () => {
    const gaps = missingRequired({ ...EDITS, vendor: " ", spendAnalysis: "" });
    expect(gaps).toContain("Merchant name");
    expect(gaps).toContain("Spend Analysis");
    expect(gaps).toHaveLength(2);
  });
  it("requires description + total on any present line item", () => {
    const gaps = missingRequired({
      ...EDITS,
      lineItems: [{ description: "", quantity: null, unitPrice: null, total: "1.00" }],
    });
    expect(gaps).toContain("Line item description and total");
    expect(missingRequired({ ...EDITS, lineItems: [] })).toEqual([]);
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
    mandatoryAuth: emptyMandatoryAuth(),
  };

  it("trims fields and coerces blank nullable fields to null", () => {
    const rec = recordFromDraft(draft, EDITS, { id: "r1", now: "2026-01-01T00:00:00.000Z" });
    expect(rec.vendor).toBe("The Exchange");
    expect(rec.totalAmount).toBe("77.47");
    expect(rec.taxAmount).toBeNull(); // whitespace-only -> null
    expect(rec.receiptNumber).toBeNull();
    expect(rec.invoiceNumber).toBeNull();
    expect(rec.cardLast4).toBe("4421");
  });

  it("derives the checklist from the edited DocType, not the draft's", () => {
    const rec = recordFromDraft(draft, { ...EDITS, docType: "invoice" }, { id: "r1" });
    expect(rec.docType).toBe("invoice");
    expect(rec.documentChecklist.invoiceUploaded).toBe(true);
    expect(rec.documentChecklist.receiptUploaded).toBe(false);
  });

  it("carries the US Bank order fields, trimming the requestor and defaulting blank ETO", () => {
    const rec = recordFromDraft(draft, { ...EDITS, emergencyTypeOperation: "  " }, { id: "r1" });
    expect(rec.requestorName).toBe("Jordan Reyes");
    expect(rec.emergencyTypeOperation).toBe("Not in support of ETO");

    const inSupport = recordFromDraft(draft, { ...EDITS, emergencyTypeOperation: "In Support of ETO" }, { id: "r1" });
    expect(inSupport.emergencyTypeOperation).toBe("In Support of ETO");
  });

  it("carries the 889 determination from the edits — not hardcoded null", () => {
    const saved = {
      entity: {
        uei: "ABC123", cage: null, legalName: "ACME", url: null, addressLines: [],
        registrationStatus: "A", activationDate: null, expirationDate: null,
        hasActiveExclusion: false, isSelectable: true,
        compliance: { isCompliant: true, statusText: "ok", farProvisionDate: null, farC1: null, farC2: null },
      },
      checkedAt: "2026-01-01T00:00:00.000Z",
    };
    const rec = recordFromDraft(draft, { ...EDITS, section889: saved }, { id: "r1" });
    expect(rec.section889).toEqual(saved);
  });

  it("carries source, rawText and id straight from the draft and context", () => {
    const rec = recordFromDraft(draft, EDITS, { id: "abc" });
    expect(rec.id).toBe("abc");
    expect(rec.source).toBe("tesseract");
    expect(rec.rawOcrText).toBe("raw text");
  });
});
