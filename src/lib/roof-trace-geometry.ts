import { checkOutline } from "@/lib/roof-outline";
import { regularizeRing } from "@/lib/roof-regularize";

export type PreparedTraceRing = {
  ring: number[][];
  delta_pct: number;
  flagged: boolean;
  used_raw: boolean;
};

/** Keep a valid raw trace when cosmetic square-up would invalidate it. */
export function prepareTraceRing(rawRing: number[][]): PreparedTraceRing | null {
  if (!checkOutline(rawRing).ok) return null;
  try {
    const regularized = regularizeRing(rawRing);
    if (regularized.ring.length >= 3 && checkOutline(regularized.ring).ok) {
      return {
        ring: regularized.ring,
        delta_pct: Math.round(regularized.areaDeltaPct * 100) / 100,
        flagged: regularized.flagged,
        used_raw: false,
      };
    }
  } catch {
    // The original AI trace is already valid and remains the source of truth.
  }
  return { ring: rawRing, delta_pct: 0, flagged: false, used_raw: true };
}