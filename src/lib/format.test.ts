import { describe, expect, it } from "vitest";
import { confidenceBucket, formatAmount, formatDateUS, orDash, toISODate } from "./format";

describe("formatAmount", () => {
  it("formats with symbol, code fallback, and dash for empty", () => {
    expect(formatAmount("1830.5", "USD")).toBe("$1,830.50");
    expect(formatAmount("12", "KRW")).toBe("₩12.00");
    expect(formatAmount("12", "CHF")).toBe("CHF 12.00");
    expect(formatAmount("12")).toBe("12.00");
    expect(formatAmount("", "USD")).toBe("—");
    expect(formatAmount(null)).toBe("—");
  });
  it("passes non-numeric values through instead of NaN", () => {
    expect(formatAmount("n/a", "USD")).toBe("$n/a");
  });
});

describe("toISODate", () => {
  it("normalizes US slashes, EU dots, and ISO", () => {
    expect(toISODate("10/17/2024")).toBe("2024-10-17");
    expect(toISODate("22.04.2026")).toBe("2026-04-22");
    expect(toISODate("2026-04-22")).toBe("2026-04-22");
  });
  it("returns '' when it can't parse confidently", () => {
    expect(toISODate("Oct 17 2024")).toBe("");
    expect(toISODate("")).toBe("");
    expect(toISODate(null)).toBe("");
  });
});

describe("formatDateUS", () => {
  it("renders MM/DD/YYYY and falls back to the raw value", () => {
    expect(formatDateUS("2024-10-17")).toBe("10/17/2024");
    expect(formatDateUS("22.04.2026")).toBe("04/22/2026");
    expect(formatDateUS("sometime in May")).toBe("sometime in May");
    expect(formatDateUS("")).toBe("—");
  });
});

describe("orDash", () => {
  it("dashes blank and whitespace-only values", () => {
    expect(orDash("x")).toBe("x");
    expect(orDash("  ")).toBe("—");
    expect(orDash(null)).toBe("—");
  });
});

describe("confidenceBucket", () => {
  it("buckets at the documented thresholds", () => {
    expect(confidenceBucket(1)).toBe("High");
    expect(confidenceBucket(0.85)).toBe("High");
    expect(confidenceBucket(0.6)).toBe("Medium");
    expect(confidenceBucket(0.59)).toBe("Low");
  });
});
