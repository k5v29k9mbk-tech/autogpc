// parseReceipt — the primary structurer in Sprint 1.
//
// Pure, dependency-free, UI-free. It turns the RAW TEXT returned by the
// PDF-text and Tesseract paths into structured fields. When a cloud extractor
// is added later it returns structured fields directly and this becomes a
// fallback. Design rule: prefer returning `null` over a wrong guess — the
// review screen exists to fill gaps, and a confident wrong value is worse than
// a blank one in an audit context.

import type { LineItem } from "./types";

export type ParsedReceipt = {
  vendor: string | null;
  transactionDate: string | null;
  totalAmount: string | null;
  currency: string | null;
  taxAmount: string | null;
  cardLast4: string | null;
  receiptNumber: string | null;
  invoiceNumber: string | null;
  lineItems: LineItem[];
};

// ---------------------------------------------------------------------------
// Amount + currency helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Normalize a messy monetary token into a plain numeric string with a `.`
 * decimal separator and no thousands grouping. Handles both US (`1,234.56`)
 * and EU (`1.234,56`) conventions.
 *
 *   "$1,234.56" -> "1234.56"   "1.234,56 €" -> "1234.56"
 *   "12,00"     -> "12.00"     "1.234"      -> "1234"
 *   "99.95"     -> "99.95"     "1,234"      -> "1234"
 */
export function normalizeAmount(raw: string): string | null {
  const s = raw.replace(/[^\d.,-]/g, "").trim();
  if (!/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const commaCount = (s.match(/,/g) || []).length;
  const dotCount = (s.match(/\./g) || []).length;

  let decimalSep = "";
  if (lastComma > -1 && lastDot > -1) {
    // The right-most separator is the decimal one.
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma > -1) {
    const after = s.length - lastComma - 1;
    decimalSep = commaCount === 1 && after >= 1 && after <= 2 ? "," : "";
  } else if (lastDot > -1) {
    const after = s.length - lastDot - 1;
    decimalSep = dotCount === 1 && after >= 1 && after <= 2 ? "." : "";
  }

  let intPart: string;
  let fracPart = "";
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx).replace(/[.,]/g, "");
    fracPart = s.slice(idx + 1).replace(/[.,]/g, "");
  } else {
    intPart = s.replace(/[.,]/g, "");
  }

  const neg = intPart.startsWith("-");
  intPart = intPart.replace(/[^\d]/g, "");
  if (!intPart && !fracPart) return null;

  const body = fracPart ? `${intPart || "0"}.${fracPart}` : intPart || "0";
  return neg ? `-${body}` : body;
}

export function detectCurrency(text: string): string | null {
  const hasEur = /€|\bEUR\b|\bMwSt\b|\bUSt\b/i.test(text);
  const hasUsd = /\$|\bUSD\b/i.test(text);
  const hasGbp = /£|\bGBP\b/i.test(text);

  if (hasEur && !hasUsd) return "EUR";
  if (hasUsd && !hasEur) return "USD";
  if (hasEur && hasUsd) {
    const eurHits = (text.match(/€|\bEUR\b/gi) || []).length;
    const usdHits = (text.match(/\$|\bUSD\b/gi) || []).length;
    return eurHits >= usdHits ? "EUR" : "USD";
  }
  if (hasGbp) return "GBP";
  return null;
}

// Pull every monetary-looking token out of a line, dropping any number that is
// immediately a percentage (e.g. the "19" in "MwSt 19%").
function amountsInLine(line: string): string[] {
  const out: string[] = [];
  const re = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d+)\s*(%?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[2] === "%") continue; // skip percentages
    const norm = normalizeAmount(m[1]);
    if (norm) out.push(norm);
  }
  return out;
}

function preferMonetary(line: string): string | null {
  const re = /[€$£]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})/g;
  const decimals: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (line[m.index - 1] === "%") continue;
    const tail = line.slice(m.index + m[0].length).trimStart();
    if (tail.startsWith("%")) continue;
    const norm = normalizeAmount(m[1]);
    if (norm) decimals.push(norm);
  }
  if (decimals.length) return decimals[decimals.length - 1];
  const all = amountsInLine(line);
  return all.length ? all[all.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
}

const DATE_RES = [
  /\b(\d{4}-\d{1,2}-\d{1,2})\b/, // YYYY-MM-DD
  /\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/, // DD.MM.YYYY
  /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/, // MM/DD/YYYY or DD/MM/YYYY
];

export function parseDate(text: string): string | null {
  const lines = cleanLines(text);
  // Prefer a date that sits on a line mentioning "date" / "datum".
  for (const line of lines) {
    if (/\b(date|datum|dated|trans(?:action)?\s*date)\b/i.test(line)) {
      for (const re of DATE_RES) {
        const m = line.match(re);
        if (m) return m[1];
      }
    }
  }
  for (const re of DATE_RES) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

const SUBTOTAL_RE = /sub\s*-?\s*total|zwischensumme|net\b|netto|subtotal/i;
const TAXLINE_RE = /\b(tax|vat|mwst|ust|iva|sales\s*tax|steuer)\b/i;

const TOTAL_KEYWORDS: { re: RegExp; rank: number }[] = [
  { re: /grand\s*total|gesamtbetrag|gesamtsumme|rechnungsbetrag/i, rank: 5 },
  { re: /total\s*due|amount\s*due|balance\s*due|zu\s*zahlen|endbetrag/i, rank: 4 },
  { re: /\btotal\b|\bsumme\b|\bgesamt\b|\bbetrag\b/i, rank: 3 },
  { re: /\bbalance\b/i, rank: 2 },
  { re: /\bamount\b/i, rank: 1 },
];

export function parseTotal(text: string): string | null {
  const lines = cleanLines(text);
  let best: { rank: number; amount: string } | null = null;

  for (const line of lines) {
    if (SUBTOTAL_RE.test(line)) continue;
    // A line that is purely a tax line is not the grand total.
    if (TAXLINE_RE.test(line) && !/\btotal\b|gesamt|summe/i.test(line)) continue;

    let rank = 0;
    for (const kw of TOTAL_KEYWORDS) {
      if (kw.re.test(line)) {
        rank = Math.max(rank, kw.rank);
      }
    }
    if (rank === 0) continue;

    const amount = preferMonetary(line);
    if (!amount) continue;

    if (
      !best ||
      rank > best.rank ||
      (rank === best.rank && parseFloat(amount) > parseFloat(best.amount))
    ) {
      best = { rank, amount };
    }
  }
  if (best) return best.amount;

  // Fallback: the largest currency-adjacent decimal number anywhere.
  const re = /[€$£]\s*(\d[\d.,]*\d|\d)|(\d[\d.,]*\d|\d)\s*[€$£]/g;
  let m: RegExpExecArray | null;
  let max: number | null = null;
  let maxStr: string | null = null;
  while ((m = re.exec(text))) {
    const norm = normalizeAmount(m[1] ?? m[2] ?? "");
    if (!norm) continue;
    const val = parseFloat(norm);
    if (max === null || val > max) {
      max = val;
      maxStr = norm;
    }
  }
  return maxStr;
}

export function parseTax(text: string): string | null {
  const lines = cleanLines(text);
  for (const line of lines) {
    if (!TAXLINE_RE.test(line)) continue;
    const amount = preferMonetary(line);
    if (amount) return amount;
  }
  return null;
}

const CARD_RES = [
  /(?:\*{2,}|x{2,}|#{2,}|•{2,})\s*(\d{4})\b/i,
  /\bending\s*(?:in|with)?\s*(\d{4})\b/i,
  /\b(?:visa|mastercard|master\s*card|amex|american\s*express|discover|maestro|debit|credit|ec[-\s]?karte|girocard|card|karte)\b[^\d]{0,10}(\d{4})\b/i,
  /\bxxxx[\s-]?(\d{4})\b/i,
];

export function parseCardLast4(text: string): string | null {
  for (const re of CARD_RES) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

function findReference(text: string, keywords: RegExp): string | null {
  // Keyword and value must sit on the same line (no \n in the separators), and
  // the captured token must contain a digit — so a value-less keyword line
  // (e.g. a standalone "Quotation" header) is skipped in favour of the real
  // "Quote No: ..." line that follows.
  const sep = "[ \\t]*[-:#.]?[ \\t]*";
  const re = new RegExp(
    keywords.source + sep + "(?:no\\.?|nr\\.?|num(?:ber)?)?" + sep + "([A-Za-z0-9][A-Za-z0-9\\-\\/]{2,})",
    "i",
  );
  const m = text.match(re);
  if (m && /\d/.test(m[1])) {
    return m[1].replace(/[.,;:]+$/, "");
  }
  return null;
}

export function parseInvoiceNumber(text: string): string | null {
  return findReference(
    text,
    /\b(?:invoice|rechnung(?:s)?(?:-?nr)?|quote|quotation|angebot|order|bestell(?:ung)?)\b/,
  );
}

export function parseReceiptNumber(text: string): string | null {
  return findReference(
    text,
    /\b(?:receipt|transaction|trans|ref(?:erence)?|auth(?:orization|orisation)?|beleg|bon)\b/,
  );
}

const VENDOR_SKIP =
  /^(?:receipt|invoice|quote|quotation|rechnung|beleg|bon|order|tax\s*invoice|customer\s*copy|merchant\s*copy)$/i;

const CONTACT_LINE = /@|\bwww\.|https?:|\b(phone|tel|fax)\b/i;

// Casing tiers for vendor candidates. Tier 1: ALL-CAPS storefront banner
// ("EXCHANGE") — how receipt headers are usually printed. Tier 2: normal
// mixed-case print ("toom Baumarkt", "Better Direct LLC"). Tier 3: odd casing
// — a lowercase→uppercase flip inside a word ("muteR" is mirrored "Return"
// read through thermal-paper bleed-through). Tier 4: all-lowercase noise or
// digit-led lines (street addresses, never names).
function vendorTier(c: string): number {
  if (/^\d/.test(c)) return 4;
  if (!/[A-ZÀ-Þ]/.test(c)) return 4;
  if (!/[a-zà-ÿ]/.test(c)) return 1;
  const oddCased = c.split(/\s+/).some((w) => /[a-zà-ÿ][A-ZÀ-Þ]/.test(w));
  return oddCased ? 3 : 2;
}

function pickVendor(lines: string[]): string | null {
  const candidates: string[] = [];
  for (const line of lines) {
    const letters = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    if (letters < 3) continue; // skip pure numbers / separators
    if (VENDOR_SKIP.test(line)) continue;
    if (DATE_RES.some((re) => re.test(line))) continue;
    if (/^[\d\s.,:/-]+$/.test(line)) continue;
    if (CONTACT_LINE.test(line)) continue;
    if (/\d+[.,]\d{2}/.test(line)) continue; // monetary lines are never names
    candidates.push(line.replace(/\s{2,}/g, " ").slice(0, 60));
  }
  for (const tier of [1, 2, 3, 4]) {
    const hit = candidates.find((c) => vendorTier(c) === tier);
    if (hit) return hit;
  }
  return null;
}

export function parseVendor(text: string): string | null {
  const lines = cleanLines(text);
  // Storefront headers sit immediately above the contact block (phone / web /
  // email). Scanned thermal receipts often carry MANY lines of mirrored
  // bleed-through from the back of the paper above the real header, so "first
  // plausible line on the page" is unreliable — when a contact block exists,
  // search the few lines just above it instead.
  const anchor = lines.findIndex((l) => CONTACT_LINE.test(l));
  if (anchor > 0) {
    const fromAnchor = pickVendor(lines.slice(Math.max(0, anchor - 4), anchor));
    if (fromAnchor) return fromAnchor;
  }
  return pickVendor(lines.slice(0, 8));
}

// Conservative line-item heuristic. Better to under-extract than to invent
// rows; the review screen lets a user add what we miss.
export function parseLineItems(text: string): LineItem[] {
  // Unlike cleanLines, keep internal spacing: the 2+-space column gap is the
  // description/price separator that simpleRow keys on.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const items: LineItem[] = [];
  const qtyRow = /^(.{2,48}?)\s+(\d{1,4})\s*[xX@]\s*([€$£]?\s*[\d.,]+)\s+([€$£]?\s*[\d.,]+)$/;
  const simpleRow = /^(.{3,48}?)\s{2,}([€$£]?\s*\d[\d.,]*[.,]\d{2})$/;

  for (const line of lines) {
    if (/\b(sub)?total|tax|vat|mwst|balance|amount\s*due|summe|gesamt|change|tender|cash|card/i.test(line)) {
      continue;
    }
    // Adjustment rows, not purchases: discounts, refund-value notes, surcharges.
    if (/\b(trans\.?\s*disc\w*|discount|refund|unit\s*charge|savings)\b/i.test(line)) {
      continue;
    }
    const q = line.match(qtyRow);
    if (q) {
      items.push({
        description: q[1].trim(),
        quantity: q[2],
        unitPrice: normalizeAmount(q[3]),
        total: normalizeAmount(q[4]),
      });
      continue;
    }
    const s = line.match(simpleRow);
    if (s) {
      items.push({
        description: s[1].trim(),
        quantity: null,
        unitPrice: null,
        total: normalizeAmount(s[2]),
      });
    }
  }
  return items.slice(0, 25);
}

// ---------------------------------------------------------------------------
// Top-level
// ---------------------------------------------------------------------------

export function parseReceipt(rawText: string): ParsedReceipt {
  const text = rawText ?? "";
  return {
    vendor: parseVendor(text),
    transactionDate: parseDate(text),
    totalAmount: parseTotal(text),
    currency: detectCurrency(text),
    taxAmount: parseTax(text),
    cardLast4: parseCardLast4(text),
    receiptNumber: parseReceiptNumber(text),
    invoiceNumber: parseInvoiceNumber(text),
    lineItems: parseLineItems(text),
  };
}
