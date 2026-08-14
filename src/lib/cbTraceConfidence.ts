/**
 * Confidence scoring for an AI-traced roof footprint.
 *
 * The satellite tracer never tells us how sure it is, so we score the geometry
 * it produced: real roof outlines are made of long edges meeting at near-square
 * (or near-straight) corners. Stubby edges and ragged angles are the signature
 * of shadow bleed, a patio caught in the mask, or tree overhang — exactly the
 * places a rep should tap and drag before saving.
 */
import { pointDistanceFeet } from "@/lib/cbRoofPlan";

export type EdgeConfidence = {
  index: number;
  /** 0..1 */
  score: number;
  lengthFt: number;
  reason: string | null;
};

export type TraceConfidence = {
  /** 0..1 weighted by edge length. */
  score: number;
  /** 0..100, rounded — what we show. */
  percent: number;
  label: "High" | "Medium" | "Low";
  edges: EdgeConfidence[];
  lowCount: number;
};

export const CONFIDENCE_COLORS = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
} as const;

export function confidenceColor(score: number): string {
  if (score >= 0.75) return CONFIDENCE_COLORS.high;
  if (score >= 0.5) return CONFIDENCE_COLORS.medium;
  return CONFIDENCE_COLORS.low;
}

function angleAt(ring: number[][], i: number): number {
  const n = ring.length;
  const prev = ring[(i - 1 + n) % n];
  const cur = ring[i];
  const next = ring[(i + 1) % n];
  const a = Math.atan2(prev[1] - cur[1], prev[0] - cur[0]);
  const b = Math.atan2(next[1] - cur[1], next[0] - cur[0]);
  let d = Math.abs((b - a) * (180 / Math.PI));
  if (d > 180) d = 360 - d;
  return d;
}

/** How far an angle sits from the nearest "architectural" value (90/135/180). */
function anglePenalty(deg: number): number {
  const targets = [90, 135, 180, 45, 270];
  const off = Math.min(...targets.map((t) => Math.abs(deg - t)));
  return Math.min(1, off / 35);
}

/**
 * Score every edge of an open ring. `aiRing`, when supplied, is the untouched
 * AI shape — edges the rep already corrected score as trusted.
 */
export function traceConfidence(ring: number[][], aiRing?: number[][] | null): TraceConfidence {
  if (!ring || ring.length < 3) {
    return { score: 0, percent: 0, label: "Low", edges: [], lowCount: 0 };
  }
  const n = ring.length;
  const edges: EdgeConfidence[] = [];
  let weighted = 0;
  let totalLen = 0;

  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const lengthFt = pointDistanceFeet(a, b);
    const shortPenalty = lengthFt >= 12 ? 0 : Math.min(1, (12 - lengthFt) / 12);
    const cornerPenalty = (anglePenalty(angleAt(ring, i)) + anglePenalty(angleAt(ring, (i + 1) % n))) / 2;

    let score = 1 - (shortPenalty * 0.55 + cornerPenalty * 0.45);

    // A corner the rep already moved is ground truth, not a guess.
    let corrected = false;
    if (aiRing && aiRing.length === n) {
      const moved = pointDistanceFeet(a, aiRing[i]);
      if (moved > 1.5) {
        corrected = true;
        score = 1;
      }
    }

    score = Math.max(0.05, Math.min(1, score));
    const reason = corrected
      ? "You corrected this edge"
      : shortPenalty > 0.4
        ? "Very short edge — likely shadow or overhang"
        : cornerPenalty > 0.5
          ? "Ragged corner — drag it onto the roof line"
          : null;

    edges.push({ index: i, score, lengthFt, reason });
    weighted += score * Math.max(lengthFt, 1);
    totalLen += Math.max(lengthFt, 1);
  }

  const score = totalLen > 0 ? weighted / totalLen : 0;
  return {
    score,
    percent: Math.round(score * 100),
    label: score >= 0.8 ? "High" : score >= 0.6 ? "Medium" : "Low",
    edges,
    lowCount: edges.filter((e) => e.score < 0.5).length,
  };
}
