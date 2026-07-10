import { describe, it, expect } from "vitest";
import { detectKnownVendor } from "./knownVendors";
import { parseVendor } from "./parseReceipt";

// Verbatim Tesseract output from real scanned BX receipts — the storefront
// logo never OCRs, and every other line arrives with thermal-scan noise.
const BX_OCR_HIGH_RES = [
  "x",
  "Ranstein XHCC Mall",
  "Brian A Spith",
  "PHONE: 4+49(0)6371-4079 x103",
  "UU SHOPHYE XCHANGE . CON", // WWW.SHOPMYEXCHANGE.COM through OCR noise
  "TOTAL 9 370.62",
  "THANK YOU FOR SHOPPING EXCHANGE",
].join("\n");

const BX_OCR_LOW_RES = [
  "5",
  "Ranstain KHCC Hall",
  "Brian A Saith",
  "PHONE: 4490363714079 x403",
  "UM. SHOPHYEXCHANGE CON",
  "TOTAL 1 370.62",
  "THANK YOU FOR SHOPPING EXCHANGE",
].join("\n");

// Textract reads the logo banner as its own line (api/fixtures golden case).
const BX_TEXTRACT = "EXCHANGE\nRamstein KMCC Mall\nTOTAL 40.45";

// aafes.com cashier email, no readable domain/footer.
const BX_EMAIL_ONLY = "Ramstein MCSS\nWilliam Carlon\ncarlonw@aafes.com\nTOTAL 555.65";

describe("detectKnownVendor — Exchange (AAFES)", () => {
  it.each([
    ["high-res Tesseract scan", BX_OCR_HIGH_RES],
    ["low-res Tesseract scan", BX_OCR_LOW_RES],
    ["Textract banner line", BX_TEXTRACT],
    ["aafes.com email only", BX_EMAIL_ONLY],
  ])("detects EXCHANGE from %s", (_label, text) => {
    const known = detectKnownVendor(text);
    expect(known?.name).toBe("EXCHANGE");
    expect(known?.designation889).toBe("889 Government");
    expect(parseVendor(text)).toBe("EXCHANGE");
  });

  it("does not fire on other vendors mentioning exchanges/returns", () => {
    const other = [
      "United Office Solutions",
      "123 Main St",
      "Returns and exchanges accepted within 30 days",
      "See our exchange policy at the service desk",
      "TOTAL $43.20",
    ].join("\n");
    expect(detectKnownVendor(other)).toBeNull();
    expect(parseVendor(other)).toBe("United Office Solutions");
  });

  it("does not treat a mid-document EXCHANGE line as the banner", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Item line ${i + 1} description`);
    lines.push("EXCHANGE"); // e.g. a return/exchange slip section header far down
    expect(detectKnownVendor(lines.join("\n"))).toBeNull();
  });
});
