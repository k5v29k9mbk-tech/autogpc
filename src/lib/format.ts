// Display formatting helpers. Pure and UI-free.

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  KRW: "₩",
};

/** 38 -> "0:38", 72 -> "1:12" */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** 6420 -> "1h 47m", 2820 -> "47m", 40 -> "< 1m" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return "< 1m";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

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
