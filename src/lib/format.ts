// Display formatting helpers. Pure and UI-free.

import { toIsoDate } from "../core/dates";

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  KRW: "₩",
};

/** Format a normalized numeric string ("1830.5") with its currency. */
export function formatAmount(value: string | null | undefined, currency?: string | null): string {
  if (!value) return "—";
  const num = Number(value);
  const body = Number.isFinite(num)
    ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
    : value;
  if (!currency) return body;
  const symbol = CURRENCY_SYMBOL[currency];
  return symbol ? `${symbol}${body}` : `${currency} ${body}`;
}

export function orDash(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

/**
 * Parse a date string in any format the extractor emits into an ISO
 * `yyyy-mm-dd` string — the value a native `<input type="date">` and our
 * storage both want. Delegates to core/dates (the one owner of the
 * slash-is-US / dot-is-EU convention); "" instead of null so callers can
 * fall back to the raw value.
 */
export function toISODate(value: string | null | undefined): string {
  return toIsoDate(value) ?? "";
}

/** Format a stored date as American MM/DD/YYYY. Falls back to the raw value. */
export function formatDateUS(value: string | null | undefined): string {
  if (!value || !value.trim()) return "—";
  const iso = toISODate(value);
  if (!iso) return value;
  const [y, mo, d] = iso.split("-");
  return `${mo}/${d}/${y}`;
}

/** Bucket a 0..1 confidence into a label — "100%" reads as not credible. */
export function confidenceBucket(c: number): "High" | "Medium" | "Low" {
  if (c >= 0.85) return "High";
  if (c >= 0.6) return "Medium";
  return "Low";
}
