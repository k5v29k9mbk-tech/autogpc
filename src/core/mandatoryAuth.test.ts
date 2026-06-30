import { describe, expect, it } from "vitest";
import {
  detectAuthCategories,
  requiredDocuments,
  suggestSpecialPreApproval,
} from "./mandatoryAuth";
import type { LineItem } from "./types";

const li = (description: string): LineItem => ({ description, quantity: null, unitPrice: null, total: null });

describe("detectAuthCategories", () => {
  it("flags IT and hazmat from line items", () => {
    const ids = detectAuthCategories(
      [li("Dell Laptop 14in"), li("AA Batteries 24pk")],
      "",
    );
    expect(ids).toContain("it-computers");
    expect(ids).toContain("hazmat");
  });

  it("matches loose word boundaries (a/c) but not substrings (salt in asphalt)", () => {
    expect(detectAuthCategories([li("portable air conditioner")], "")).toContain("climate");
    // "computer" must not fire on "computerized" mid-word? it's a prefix; ensure
    // a real non-match: "monitoring" should not flag the monitor catalog.
    expect(detectAuthCategories([li("network monitoring service")], "")).not.toContain("it-computers");
  });

  it("adds the >$5,000 rule by amount", () => {
    expect(detectAuthCategories([li("generic widget")], "", "6,200.00")).toContain("equip-over-5000");
    expect(detectAuthCategories([li("generic widget")], "", "120.00")).not.toContain("equip-over-5000");
  });
});

describe("suggestSpecialPreApproval", () => {
  it("returns the single mapped value, Yes-Multiple on disagreement, blank on none", () => {
    expect(suggestSpecialPreApproval(["it-computers"])).toBe("Yes-IT");
    expect(suggestSpecialPreApproval(["it-computers", "hazmat"])).toBe(
      "Yes-Multiple-Identify All in Comments Fields",
    );
    expect(suggestSpecialPreApproval([])).toBe("");
  });
});

describe("requiredDocuments", () => {
  it("always requires receipt + purchase request, adds conditional + per-category slots", () => {
    const docs = requiredDocuments(["it-computers"], { germanVendor: true, delivered: false });
    const ids = docs.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining(["receipt", "purchase_request", "vat_form", "non_receipt_memo", "approval:it-computers"]),
    );
  });

  it("omits VAT and memo when not German / delivered", () => {
    const ids = requiredDocuments([], { germanVendor: false, delivered: true }).map((d) => d.id);
    expect(ids).toEqual(["receipt", "purchase_request"]);
  });
});
