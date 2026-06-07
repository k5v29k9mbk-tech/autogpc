// Display formatting helpers. Pure and UI-free.

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
