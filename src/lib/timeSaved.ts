// The persuasion math: every captured record saves (manual baseline − actual
// capture time). Kept pure so it can be unit-tested and reused on iOS.

import { MANUAL_BASELINE_SECONDS, type PurchaseRecord } from "../core/types";

export function savedSecondsFor(record: PurchaseRecord): number {
  if (record.captureSeconds == null) return 0;
  return Math.max(0, MANUAL_BASELINE_SECONDS - record.captureSeconds);
}

export type SavingsSummary = {
  totalSavedSeconds: number;
  recordCount: number;
  avgCaptureSeconds: number | null;
};

export function summarizeSavings(records: PurchaseRecord[]): SavingsSummary {
  const timed = records.filter((r) => r.captureSeconds != null);
  const totalSavedSeconds = records.reduce((sum, r) => sum + savedSecondsFor(r), 0);
  const avgCaptureSeconds =
    timed.length > 0
      ? timed.reduce((s, r) => s + (r.captureSeconds ?? 0), 0) / timed.length
      : null;
  return { totalSavedSeconds, recordCount: records.length, avgCaptureSeconds };
}
