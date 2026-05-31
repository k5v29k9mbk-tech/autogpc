import { useEffect, useState } from "react";

/** Live elapsed seconds since `startedAt` (ms). Pass null to pause. */
export function useElapsed(startedAt: number | null, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt == null || !active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt, active]);
  if (startedAt == null) return 0;
  return Math.max(0, (now - startedAt) / 1000);
}
