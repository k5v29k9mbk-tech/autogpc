// Vendor-identity rules shared by BOTH extraction tiers — the serverless
// Textract post-processor (api/textractPostProcessor.ts) and the client regex
// parser (core/parseReceipt.ts). These encode the thermal bleed-through
// defense: mirrored text from the back of the paper OCRs as gibberish above
// the real header, and both tiers must reject it the same way. They lived as
// separate copies ("seven one-liners") until the copies drifted — accented
// characters, "total savings" vs "savings". One owner now.
//
// The tiers still keep their own *positional* heuristics (candidate scoring
// server-side, contact-block anchoring client-side) — those are tuned to the
// different text shapes each tier sees. What's shared here is the judgement
// "this text can never be a business name / purchase row".

/** Lowercase, letters/digits only (accents kept) — for fuzzy "does this appear in the OCR text". */
export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9à-ÿ]/g, "");
}

// A receipt's business name is none of these. One line per rejection reason:
// phone, date, money/total/tax, txn/receipt id, masked card, url/email,
// street address, and boilerplate header/footer lines.
export const NOT_VENDOR_LINE: RegExp[] = [
  /\+?\d[\d\s().-]{6,}\d/, // phone-like digit run
  /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b/, // date
  /\d[.,]\d{2}\b|[€$£]|\b(total|subtotal|tax|vat|mwst|ust|change|tender|balance|amount\s*due|gesamt|summe)\b/i, // money / total / tax
  /\b(receipt|invoice|trans(?:action)?|ref(?:erence)?|auth|order|beleg|bon|no|nr)\b\.?\s*[:#]?\s*\w*\d/i, // txn / receipt id
  /(?:\*{2,}|x{2,}|#{2,}|•{2,})\s*\d{4}\b|\bxxxx[\s-]?\d{4}\b/i, // masked card
  /@|\bwww\.|https?:\/\//i, // url / email
  /^\d+\s+\S|\b(str(?:\.|asse|aße)|street|st\.|ave\.?|avenue|road|rd\.?|blvd|suite|ste\.?|p\.?o\.?\s*box)\b/i, // street address
  /^(?:thank|welcome|receipt|invoice|quote|quotation|customer\s*copy|merchant\s*copy|order|tax\s*invoice|cash)\b/i, // boilerplate
];

export function isNotVendorLine(text: string): boolean {
  return NOT_VENDOR_LINE.some((re) => re.test(text));
}

/**
 * Shape check: a real name has letters and isn't a bleed-through signature — a
 * single all-lowercase token ("pnivotomi"), or a lowercase→uppercase flip
 * ("muteR" is mirrored "Return" read through thermal-paper bleed-through).
 */
export function plausibleVendor(v: string): boolean {
  if ((v.match(/[A-Za-zÀ-ÿ]/g) || []).length < 2) return false;
  if (/\s/.test(v)) return true; // multi-word names pass
  if (!/[A-ZÀ-Þ]/.test(v)) return false; // no capital ("gorl2", "pnivotomi")
  if (/^[a-zà-ÿ]+[A-ZÀ-Þ]{1,2}$/.test(v)) return false; // "muteR"
  return true;
}

/**
 * Line-item rows that aren't purchases: discounts, refund-value notes,
 * surcharges, savings summaries. Applied by both the Textract line-item mapper
 * and the client parser ("savings" also covers "total savings").
 */
export const ADJUSTMENT_ROW = /\b(trans\.?\s*disc\w*|discount|refund|unit\s*charge|savings)\b/i;
