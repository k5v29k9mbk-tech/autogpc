// Known-vendor canonicalization — deterministic overrides for vendors the
// heuristics keep getting wrong and that carry policy consequences.
//
// A BX/PX receipt prints the AAFES "X" logo as its storefront banner, which
// local OCR cannot read at all — the top printed lines are only the mall and
// the cashier, so any generic "top line" heuristic picks the wrong name. But
// every Exchange receipt carries several redundant machine-readable markers
// (shopmyexchange.com, aafes.com, the thank-you footer). If any marker hits,
// the vendor is EXCHANGE — no heuristic gets a vote.
//
// AAFES is intragovernmental, so the US Bank "889 Designation" for an Exchange
// purchase is always "889 Government"; the review form seeds it from here.

import type { DESIGNATION_889_OPTIONS } from "./types";
import { normalizeForMatch } from "./vendorRules";

export type KnownVendor = {
  /** Canonical vendor name written to the record. */
  name: string;
  /** Seed for the US Bank "889 Designation" dropdown (reviewer can override). */
  designation889?: (typeof DESIGNATION_889_OPTIONS)[number];
  /** Any hit on the normalized OCR text identifies the vendor. */
  markers: RegExp[];
  /** Any hit on one of the first lines (banner zone) identifies the vendor. */
  bannerLine?: RegExp;
};

const KNOWN_VENDORS: KnownVendor[] = [
  {
    name: "EXCHANGE",
    designation889: "889 Government",
    markers: [
      /aafes/, // aafes.com emails / "AAFES" anywhere
      // shopmyexchange.com — tolerant of OCR misreads ("SHOPHYE XCHANGE")
      /shop[a-z0-9]{0,3}exchange/,
      /shoppingexchange/, // "THANK YOU FOR SHOPPING EXCHANGE" footer
    ],
    // Textract reads the logo as its own high-confidence line up top.
    bannerLine: /^exchange$/i,
  },
];

const BANNER_ZONE_LINES = 10;

export function detectKnownVendor(rawText: string): KnownVendor | null {
  if (!rawText) return null;
  const blob = normalizeForMatch(rawText);
  const topLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, BANNER_ZONE_LINES);
  for (const v of KNOWN_VENDORS) {
    if (v.markers.some((re) => re.test(blob))) return v;
    if (v.bannerLine && topLines.some((l) => v.bannerLine!.test(l))) return v;
  }
  return null;
}
