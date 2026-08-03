// Date normalization — the one owner of the app's date-reading convention:
// slash dates are read US-style (MM/DD/YYYY), dotted dates EU-style
// (DD.MM.YYYY), matching how parseReceipt detects them. lib/format and
// lib/usbankOrder used to each carry a copy of these regexes; they delegate
// here now so the convention can't drift.

/** Normalize an extracted date to YYYY-MM-DD, or null if not confidently parseable. */
export function toIsoDate(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // US MM/DD/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); // EU DD.MM.YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return textualToIso(s);
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * "19 Mar 2025", "19-Mar-2025", "Mar 19, 2025" — the form invoices and quotes
 * print, which parseReceipt now extracts. Without this the extractor hands the
 * app a date it cannot read, and the draft quietly substitutes TODAY: a wrong
 * date that looks extracted is the one thing an audit record must not carry.
 * Month is matched by its first three letters, so full names work too.
 */
function textualToIso(s: string): string | null {
  const dmy = /^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s-]+(\d{4})$/.exec(s);
  const mdy = /^([A-Za-z]{3,9})\.?[\s-]+(\d{1,2}),?[\s-]+(\d{4})$/.exec(s);
  const day = dmy?.[1] ?? mdy?.[2];
  const name = dmy?.[2] ?? mdy?.[1];
  const year = dmy?.[3] ?? mdy?.[3];
  if (!day || !name || !year) return null;
  const month = MONTHS[name.slice(0, 3).toLowerCase()];
  return month ? `${year}-${month}-${day.padStart(2, "0")}` : null;
}
