// The persuasion math: every captured record saves (manual baseline − actual
// capture time). Kept pure so it can be unit-tested and reused on iOS.

import { MANUAL_BASELINE_SECONDS, type PurchaseRecord } from "../core/types";

export function savedSecondsFor(record: PurchaseRecord): number {
  if (record.captureSeconds == null) return 0;
  return Math.max(0, MANUAL_BASELINE_SECONDS - record.captureSeconds);
}
