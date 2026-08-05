/**
 * Per-job AI measurement settings for the roof fitter.
 * Stored on jobs.ai_measure_settings and sent with each measure request.
 */
export type FootprintSource = "auto" | "osm" | "boxes";

export type MeasureTuning = {
  /** Where the building outline comes from. */
  footprint_source: FootprintSource;
  /** Merge faces that share a slope direction — fewer, larger polygons. */
  merge_small: boolean;
  /** Snap near-90° corners to the building's dominant axis. */
  snap_square: boolean;
  /** Ignore detected facets smaller than this (sqft) — kills slivers. */
  min_facet_sqft: number;
  /** Ignore facets whose centre is farther than this from the pin (feet). */
  max_facet_radius_ft: number;
  /** Lowest imagery quality allowed. HIGH = strictest, LOW = most permissive. */
  imagery_quality: "HIGH" | "MEDIUM" | "LOW";
  /** Apply the area calibration learned from saved corrections. */
  use_calibration: boolean;
};

export const DEFAULT_MEASURE_TUNING: MeasureTuning = {
  footprint_source: "auto",
  merge_small: true,
  snap_square: true,
  min_facet_sqft: 25,
  max_facet_radius_ft: 150,
  imagery_quality: "LOW",
  use_calibration: true,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const TUNING_BOUNDS = {
  min_facet_sqft: { min: 0, max: 300, step: 5 },
  max_facet_radius_ft: { min: 40, max: 400, step: 10 },
} as const;

export function normalizeTuning(raw: unknown): MeasureTuning {
  const t = (raw ?? {}) as Partial<MeasureTuning>;
  const q = t.imagery_quality;
  const src = t.footprint_source;
  return {
    footprint_source: src === "osm" || src === "boxes" ? src : "auto",
    merge_small: t.merge_small !== false,
    snap_square: t.snap_square !== false,
    min_facet_sqft: clamp(
      Number.isFinite(Number(t.min_facet_sqft))
        ? Number(t.min_facet_sqft)
        : DEFAULT_MEASURE_TUNING.min_facet_sqft,
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
    use_calibration: t.use_calibration !== false,
  };
}

/** Quality attempts allowed, strictest first, given the configured floor. */
export function qualityLadder(floor: MeasureTuning["imagery_quality"]): Array<"HIGH" | "MEDIUM" | "LOW"> {
  if (floor === "HIGH") return ["HIGH"];
  if (floor === "MEDIUM") return ["HIGH", "MEDIUM"];
  return ["HIGH", "MEDIUM", "LOW"];
}
