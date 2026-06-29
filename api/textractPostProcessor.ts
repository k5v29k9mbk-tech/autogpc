// textractPostProcessor — deterministic vendor selection + per-field confidence
// for the Textract-only extraction path.
//
// AWS Textract AnalyzeExpense is the SOLE OCR/extraction engine (api/extract.ts).
// The "smartness" here is purely a better reading of Textract's own JSON — no
// second OCR engine, no LLM. Vendor is the field Textract gets wrong most:
// thermal bleed-through and junk near the top get mislabeled VENDOR_NAME. So we
// don't trust that one label — we gather candidates (Textract's VENDOR_NAME /
// NAME plus the top OCR lines), drop anything that can't be a business name,
// then score what survives. Audit-tool rule: a blank the reviewer fills beats a
// confident wrong value.

import type { ExpenseDocument } from "@aws-sdk/client-textract";

function clean(s?: string): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Lowercase, letters/digits only — for fuzzy "does this appear in the OCR text". */
export function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9à-ÿ]/g, "");
}

// A receipt's business name is none of these. One line per rejection reason
// from the spec: phone, date, money/total/tax, txn/receipt id, masked card,
// url/email, street address, and boilerplate header/footer lines. Kept local
// and minimal on purpose — not worth coupling this server module to the client
// parser's regexes for seven one-liners.
const BLACKLIST: RegExp[] = [
  /\+?\d[\d\s().-]{6,}\d/, // phone-like digit run
  /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b/, // date
  /\d[.,]\d{2}\b|[€$£]|\b(total|subtotal|tax|vat|mwst|ust|change|tender|balance|amount\s*due|gesamt|summe)\b/i, // money / total / tax
  /\b(receipt|invoice|trans(?:action)?|ref(?:erence)?|auth|order|beleg|bon|no|nr)\b\.?\s*[:#]?\s*\w*\d/i, // txn / receipt id
  /(?:\*{2,}|x{2,}|#{2,}|•{2,})\s*\d{4}\b|\bxxxx[\s-]?\d{4}\b/i, // masked card
  /@|\bwww\.|https?:\/\//i, // url / email
  /^\d+\s+\S|\b(str(?:\.|asse|aße)|street|st\.|ave\.?|avenue|road|rd\.?|blvd|suite|ste\.?|p\.?o\.?\s*box)\b/i, // street address
  /^(?:thank|welcome|receipt|invoice|quote|quotation|customer\s*copy|merchant\s*copy|order|tax\s*invoice|cash)\b/i, // boilerplate
];

function isBlacklisted(text: string): boolean {
  return BLACKLIST.some((re) => re.test(text));
}

// Shape check: a real name has letters and isn't a bleed-through signature — a
// single all-lowercase token ("pnivotomi"), or a lowercase→uppercase flip
// ("muteR" is mirrored "Return" read through thermal-paper bleed-through).
export function plausibleVendor(v: string): boolean {
  if ((v.match(/[A-Za-zÀ-ÿ]/g) || []).length < 2) return false;
  if (/\s/.test(v)) return true; // multi-word names pass
  if (!/[A-ZÀ-Þ]/.test(v)) return false; // no capital ("gorl2", "pnivotomi")
  if (/^[a-zà-ÿ]+[A-ZÀ-Þ]{1,2}$/.test(v)) return false; // "muteR"
  return true;
}

// 0..1, higher = more name-like. Multiword and a capital read as a storefront
// banner; digits drag it down (catalog codes, phone fragments).
function cleanliness(text: string): number {
  let s = 0;
  if (/\s/.test(text)) s += 0.5; // multiword
  if (/[A-ZÀ-Þ]/.test(text)) s += 0.3; // has a capital
  if (!/\d/.test(text)) s += 0.2; // no digits
  return Math.min(1, s);
}

type CandidateLabel = "VENDOR_NAME" | "NAME" | "OCR_LINE";

type VendorCandidate = {
  text: string;
  label: CandidateLabel;
  textractConfidence: number; // 0..100
  positionRank: number; // 0..1, 1 = very top of the document
};

const LABEL_PRIOR: Record<CandidateLabel, number> = {
  VENDOR_NAME: 1, // Textract's own guess — trusted most when it survives the filters
  OCR_LINE: 0.5, // a top printed line — the positional fallback
  NAME: 0.4, // generic NAME is often the customer, not the vendor
};

// ponytail: additive score, hand-tuned weights (sum to 1). The golden-set
// harness (api/extract.golden.test.ts) is the tuning loop — move these against
// real receipt fixtures, not by guessing. Corroboration is a hard filter
// applied before scoring, so every survivor gets its flat 0.15 credit.
function scoreCandidate(c: VendorCandidate): number {
  return (
    LABEL_PRIOR[c.label] * 0.3 +
    (c.textractConfidence / 100) * 0.2 +
    cleanliness(c.text) * 0.12 +
    c.positionRank * 0.23 +
    0.15
  );
}

const VENDOR_THRESHOLD = 0.45;

/** LINE blocks in document order, above the OCR confidence floor. */
function ocrLines(doc?: ExpenseDocument, floor = 85): { text: string; confidence: number }[] {
  return (doc?.Blocks ?? [])
    .filter((b) => b.BlockType === "LINE" && b.Text && (b.Confidence ?? 100) >= floor)
    .map((b) => ({ text: clean(b.Text), confidence: b.Confidence ?? 100 }));
}

export type VendorChoice = { vendor: string; confidence: number };

/**
 * Pick the vendor from Textract's output. Returns the chosen name and a 0..1
 * confidence, or blank when nothing clears the bar (the review screen fills it).
 *
 * Hard filters first — blacklist, shape, and OCR corroboration when real OCR
 * lines exist — then score the survivors. Corroboration is a gate, not a
 * weight: a name Textract reports must actually be printed among the
 * high-confidence OCR lines, which is exactly what mirrored bleed-through
 * ("gorl2") fails. Positional candidates (the top printed lines) let us recover
 * the real name when Textract's VENDOR_NAME is junk.
 */
export function selectVendor(
  candidates: Array<{ text: string; label: "VENDOR_NAME" | "NAME"; confidence: number }>,
  doc: ExpenseDocument | undefined,
  rawTextSource: "document" | "summary",
): VendorChoice {
  const lines = ocrLines(doc);
  const ocrBlob = normalizeForMatch(lines.map((l) => l.text).join("\n"));

  const pool: VendorCandidate[] = [];
  for (const c of candidates) {
    const text = clean(c.text);
    if (text) pool.push({ text, label: c.label, textractConfidence: c.confidence, positionRank: 0.5 });
  }
  // Positional fallback: the top printed lines (a receipt prints its name up
  // top). Only the first few — the name is never buried halfway down a receipt,
  // and scanning deeper just invites a wrong guess.
  lines.slice(0, 4).forEach((l, i) => {
    pool.push({ text: l.text, label: "OCR_LINE", textractConfidence: l.confidence, positionRank: 1 / (i + 1) });
  });

  let best: { text: string; score: number } | null = null;
  for (const c of pool) {
    if (isBlacklisted(c.text)) continue;
    if (!plausibleVendor(c.text)) continue;
    // Corroboration gate — only enforceable when we actually have OCR lines.
    if (rawTextSource === "document" && c.label !== "OCR_LINE" && !ocrBlob.includes(normalizeForMatch(c.text))) {
      continue;
    }
    const score = scoreCandidate(c);
    if (!best || score > best.score) best = { text: c.text, score };
  }

  if (!best || best.score < VENDOR_THRESHOLD) return { vendor: "", confidence: 0 };
  return { vendor: best.text, confidence: Number(best.score.toFixed(2)) };
}
