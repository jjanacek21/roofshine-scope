/**
 * Per-job AI edge-detection tuning for Google Solar roof measurements.
 * Stored on jobs.ai_measure_settings and sent with each measure request.
 */
export type MeasureTuning = {
  /**
   * Edge tightness. 1.0 = fit the facet rectangle to the reported roof area.
   * Below 1 pulls edges inward (busy/overhanging roofs), above 1 pushes out.
   */
  edge_tightness: number;
  /** Ignore detected facets smaller than this (sqft) — kills slivers. */
  min_facet_sqft: number;
  /** Ignore facets whose centre is farther than this from the pin (feet). */
  max_facet_radius_ft: number;
  /** Lowest imagery quality allowed. HIGH = strictest, LOW = most permissive. */
  imagery_quality: "HIGH" | "MEDIUM" | "LOW";
};

export const DEFAULT_MEASURE_TUNING: MeasureTuning = {
  edge_tightness: 1,
  min_facet_sqft: 40,
  max_facet_radius_ft: 150,
  imagery_quality: "LOW",
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const TUNING_BOUNDS = {
  edge_tightness: { min: 0.7, max: 1.3, step: 0.01 },
  min_facet_sqft: { min: 0, max: 300, step: 5 },
  max_facet_radius_ft: { min: 40, max: 400, step: 10 },
} as const;

export function normalizeTuning(raw: unknown): MeasureTuning {
  const t = (raw ?? {}) as Partial<MeasureTuning>;
  const q = t.imagery_quality;
  return {
    edge_tightness: clamp(
      Number.isFinite(Number(t.edge_tightness)) ? Number(t.edge_tightness) : DEFAULT_MEASURE_TUNING.edge_tightness,
      TUNING_BOUNDS.edge_tightness.min,
      TUNING_BOUNDS.edge_tightness.max,
    ),
    min_facet_sqft: clamp(
      Number.isFinite(Number(t.min_facet_sqft)) ? Number(t.min_facet_sqft) : DEFAULT_MEASURE_TUNING.min_facet_sqft,
      TUNING_BOUNDS.min_facet_sqft.min,
      TUNING_BOUNDS.min_facet_sqft.max,
    ),
    max_facet_radius_ft: clamp(
      Number.isFinite(Number(t.max_facet_radius_ft))
        ? Number(t.max_facet_radius_ft)
        : DEFAULT_MEASURE_TUNING.max_facet_radius_ft,
      TUNING_BOUNDS.max_facet_radius_ft.min,
      TUNING_BOUNDS.max_facet_radius_ft.max,
    ),
    imagery_quality: q === "HIGH" || q === "MEDIUM" || q === "LOW" ? q : DEFAULT_MEASURE_TUNING.imagery_quality,
  };
}

/** Quality attempts allowed, strictest first, given the configured floor. */
export function qualityLadder(floor: MeasureTuning["imagery_quality"]): Array<"HIGH" | "MEDIUM" | "LOW"> {
  if (floor === "HIGH") return ["HIGH"];
  if (floor === "MEDIUM") return ["HIGH", "MEDIUM"];
  return ["HIGH", "MEDIUM", "LOW"];
}
