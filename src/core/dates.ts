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
  return null;
}
