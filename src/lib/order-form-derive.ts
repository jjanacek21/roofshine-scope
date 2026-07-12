// Pure mapping from roof measurements → order-form template input keys.
// Used both by the "Auto-fill from measurements" button and by the AI assistant
// populate_order_form tool.

export type RoofMeasurementFields = {
  squares?: number | null;
  total_area_sqft?: number | null;
  eaves_lf?: number | null;
  rakes_lf?: number | null;
  ridges_lf?: number | null;
  hips_lf?: number | null;
  valleys_lf?: number | null;
  gutters_lf?: number | null;
  drip_edge_lf?: number | null;
  step_flashing_lf?: number | null;
  wall_flashing_lf?: number | null;
  parapet_wall_lf?: number | null;
  predominant_pitch?: string | null;
};

// Map a roof_measurements row to the set of order-form template input keys.
// Only returns keys that we can actually derive from the measurements.
export function deriveInputsFromMeasurement(m: RoofMeasurementFields): Record<string, number> {
  const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);
  const eaves = n(m.eaves_lf);
  const rakes = n(m.rakes_lf);
  const ridges = n(m.ridges_lf);
  const hips = n(m.hips_lf);

  return {
    sq: n(m.squares),
    hip_ridge_lf: hips + ridges,
    ridge_vent_lf: ridges,
    eave_rake_lf: eaves + rakes,
    perimeter_lf: eaves + rakes,
    valley_lf: n(m.valleys_lf),
    gutter_lf: n(m.gutters_lf),
  };
}

// Merge derived values into an existing inputs bag WITHOUT overwriting keys
// the user has manually edited (tracked in `manualKeys`). Returns a summary
// of applied and skipped keys so the UI can show a diff.
export function mergeDerivedInputs(
  existing: Record<string, number>,
  derived: Record<string, number>,
  manualKeys: string[],
): { next: Record<string, number>; applied: string[]; skipped: string[] } {
  const manual = new Set(manualKeys);
  const next = { ...existing };
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const [k, v] of Object.entries(derived)) {
    if (manual.has(k)) {
      skipped.push(k);
      continue;
    }
    if (v > 0 || existing[k] == null) {
      next[k] = v;
      applied.push(k);
    }
  }
  return { next, applied, skipped };
}
