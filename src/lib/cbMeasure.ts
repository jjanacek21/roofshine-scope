import { supabase } from "@/integrations/supabase/client";
import { cbInstantMeasureFn } from "@/lib/cb-measure.functions";

/** Shape every Claim Buddy screen reads. Mirrors cb_measurements. */
export interface CbMeasurement {
  total_squares: number;
  total_area_sqft: number;
  waste_pct: number;
  pitch: string | null;
  stories: number | null;
  facets: number | null;
  ridge_lf: number;
  hip_lf: number;
  valley_lf: number;
  rake_lf: number;
  eave_lf: number;
  drip_edge_lf: number;
  starter_lf: number;
  ridge_cap_lf: number;
  wall_flashing_lf: number;
  step_flashing_lf: number;
  gutter_lf: number;
  source: string;
  raw: unknown;
  /** roof_measurements.id from the shared GC engine, when AI-measured. */
  gc_roof_measurement_id?: string | null;
}

export const CB_BLANK_MEASUREMENT: CbMeasurement = {
  total_squares: 0,
  total_area_sqft: 0,
  waste_pct: 15,
  pitch: "6/12",
  stories: 1,
  facets: null,
  ridge_lf: 0,
  hip_lf: 0,
  valley_lf: 0,
  rake_lf: 0,
  eave_lf: 0,
  drip_edge_lf: 0,
  starter_lf: 0,
  ridge_cap_lf: 0,
  wall_flashing_lf: 0,
  step_flashing_lf: 0,
  gutter_lf: 0,
  source: "manual",
  raw: {},
  gc_roof_measurement_id: null,
};

/**
 * Fields a rep types by hand. Drip edge, starter and ridge cap are NOT here:
 * they are derived from the perimeter / ridge+hip so the same footage is never
 * entered (or counted) twice.
 */
export const CB_LINEAR_FIELDS: { key: keyof CbMeasurement; label: string }[] = [
  { key: "ridge_lf", label: "Ridge" },
  { key: "hip_lf", label: "Hip" },
  { key: "valley_lf", label: "Valley" },
  { key: "rake_lf", label: "Rake" },
  { key: "eave_lf", label: "Eave" },
  { key: "wall_flashing_lf", label: "Wall flashing" },
  { key: "step_flashing_lf", label: "Step flashing" },
  { key: "gutter_lf", label: "Gutter" },
];

/** Read-only rows shown under the editable footage. */
export const CB_DERIVED_FIELDS: {
  key: "drip_edge_lf" | "starter_lf" | "ridge_cap_lf";
  label: string;
  basis: string;
}[] = [
  { key: "drip_edge_lf", label: "Drip edge", basis: "eave + rake (perimeter)" },
  { key: "starter_lf", label: "Starter", basis: "eave + rake (perimeter)" },
  { key: "ridge_cap_lf", label: "Ridge cap", basis: "ridge + hip" },
];

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Roof perimeter = eave + rake. Falls back to a traced outline length. */
export function derivePerimeter(
  m: Pick<CbMeasurement, "eave_lf" | "rake_lf">,
  fallback = 0,
): number {
  const p = (Number(m.eave_lf) || 0) + (Number(m.rake_lf) || 0);
  return r1(p > 0 ? p : fallback);
}

/** Total squares always includes waste: area x (1 + waste%) / 100. */
export function computeTotalSquares(areaSqft: number, wastePct: number): number {
  const area = Number(areaSqft) || 0;
  const waste = Number(wastePct) || 0;
  return r2((area * (1 + waste / 100)) / 100);
}

/**
 * Recompute every derived number from its basis. `overrides` keeps a hand-typed
 * value for a specific derived field.
 */
export function applyDerived(
  m: CbMeasurement,
  opts: { perimeterFallback?: number; overrides?: Partial<Record<string, boolean>> } = {},
): CbMeasurement {
  const ov = opts.overrides ?? {};
  const perimeter = derivePerimeter(m, opts.perimeterFallback ?? 0);
  const ridgeCap = r1((Number(m.ridge_lf) || 0) + (Number(m.hip_lf) || 0));
  return {
    ...m,
    total_squares: ov.total_squares
      ? m.total_squares
      : computeTotalSquares(m.total_area_sqft, m.waste_pct),
    drip_edge_lf: ov.drip_edge_lf ? m.drip_edge_lf : perimeter,
    starter_lf: ov.starter_lf ? m.starter_lf : perimeter,
    ridge_cap_lf: ov.ridge_cap_lf ? m.ridge_cap_lf : ridgeCap,
  };
}


export type CbMeasureCredit = { allowed: boolean; metered: boolean; remaining: number | null };

export type CbInstantResult =
  | {
      ok: true;
      measurement: CbMeasurement;
      credit: CbMeasureCredit;
      /** How the outline was obtained — `solar_boxes` means it was NOT traced. */
      footprint_source: string | null;
    }
  | { ok: false; reason: string; credit: CbMeasureCredit };

/**
 * One entry point for Claim Buddy measurement. Meters the workspace first,
 * then delegates to the existing GlobalContractor roof engine.
 */
export async function getInstantMeasurement({
  address,
  lat,
  lng,
  workspaceId,
  jobId,
  pins,
}: {
  address: string;
  lat: number | null;
  lng: number | null;
  workspaceId: string;
  jobId: string;
  pins?: Array<{ lat: number; lng: number }>;
}): Promise<CbInstantResult> {
  let credit: CbMeasureCredit = { allowed: true, metered: false, remaining: null };
  const { data: creditData, error: creditError } = await supabase.rpc("cb_consume_measure_credit", {
    _ws: workspaceId,
  });
  if (!creditError && creditData && typeof creditData === "object") {
    const c = creditData as Record<string, unknown>;
    credit = {
      allowed: c.allowed !== false,
      metered: c.metered === true,
      remaining: typeof c.remaining === "number" ? c.remaining : null,
    };
  }

  if (!credit.allowed) return { ok: false, reason: "no_credits", credit };
  if ((!pins || pins.length === 0) && (lat == null || lng == null)) {
    return { ok: false, reason: "no_coordinates", credit };
  }

  try {
    /*
     * Hard ceiling on the round trip. Overpass or Solar hanging used to leave
     * the screen on "Measuring..." forever with no way back.
     */
    const res = await Promise.race([
      cbInstantMeasureFn({
        data: {
          workspace_id: workspaceId,
          job_id: jobId,
          address: address ?? "",
          lat: lat ?? undefined,
          lng: lng ?? undefined,
          pins,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 45_000),
      ),
    ]);

    if (!res.ok) return { ok: false, reason: res.reason ?? "failed", credit };
    return {
      ok: true,
      credit,
      footprint_source: res.footprint_source ?? null,
      measurement: {
        ...res.measurement,
        raw: res.measurement,
        gc_roof_measurement_id: res.roof_measurement_id ?? null,
      } as CbMeasurement,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "engine_error";
    return { ok: false, reason: message === "timeout" ? "engine_timeout" : `engine_error:${message}`, credit };
  }
}

/** Sources the cb_measurements CHECK constraint accepts. */
const CB_ALLOWED_SOURCES = new Set([
  "instant",
  "manual",
  "google_solar",
  "roof_plan",
  "photo_ai",
  "third_party_report",
  "mapbox_draw",
]);

/** PostgREST errors are plain objects — surface their real message. */
function pgError(error: unknown, fallback: string): Error {
  const e = (error ?? {}) as { message?: string; details?: string; hint?: string; code?: string };
  const parts = [e.message, e.details, e.hint].filter(Boolean);
  return new Error(parts.length ? parts.join(" — ") : fallback);
}

/** Upsert cb_measurements (unique on job_id) and pre-fill the takeoff sheet. */
export async function saveCbMeasurement(
  jobId: string,
  m: CbMeasurement,
  repAdjusted: boolean,
): Promise<void> {
  const source = CB_ALLOWED_SOURCES.has(m.source) ? m.source : "instant";
  const { error } = await supabase.from("cb_measurements").upsert(
    {
      job_id: jobId,
      total_squares: m.total_squares,
      total_area_sqft: m.total_area_sqft,
      waste_pct: m.waste_pct,
      pitch: m.pitch,
      stories: m.stories,
      facets: m.facets,
      ridge_lf: m.ridge_lf,
      hip_lf: m.hip_lf,
      valley_lf: m.valley_lf,
      rake_lf: m.rake_lf,
      eave_lf: m.eave_lf,
      drip_edge_lf: m.drip_edge_lf,
      starter_lf: m.starter_lf,
      ridge_cap_lf: m.ridge_cap_lf,
      wall_flashing_lf: m.wall_flashing_lf,
      step_flashing_lf: m.step_flashing_lf,
      gutter_lf: m.gutter_lf,
      source,
      gc_roof_measurement_id: m.gc_roof_measurement_id ?? null,
      rep_adjusted: repAdjusted,
      raw: (m.raw ?? {}) as never,
    },
    { onConflict: "job_id" },
  );
  if (error) throw pgError(error, "Couldn't save the measurement");

  const { data: existing } = await supabase
    .from("cb_takeoffs")
    .select("data, elevations")
    .eq("job_id", jobId)
    .maybeSingle();

  const prevData = ((existing?.data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const safety = ((prevData.safety as Record<string, unknown>) ?? {}) as Record<string, unknown>;

  const nextData = {
    ...prevData,
    safety: { ...safety, pitch: m.pitch ?? safety.pitch, stories: m.stories ?? safety.stories },
    measurement: {
      total_squares: m.total_squares,
      total_area_sqft: m.total_area_sqft,
      waste_pct: m.waste_pct,
      pitch: m.pitch,
      stories: m.stories,
      facets: m.facets,
      source: m.source,
      rep_adjusted: repAdjusted,
      linear: Object.fromEntries(
        [...CB_LINEAR_FIELDS, ...CB_DERIVED_FIELDS].map((f) => [f.key, m[f.key as keyof CbMeasurement] as number]),
      ) as Record<string, number>,

    },
  };

  const { error: tErr } = await supabase.from("cb_takeoffs").upsert(
    {
      job_id: jobId,
      data: nextData as never,
      elevations: ((existing?.elevations as never) ?? ({} as never)),
    },
    { onConflict: "job_id" },
  );
  if (tErr) throw pgError(tErr, "Couldn't save the takeoff sheet");
}
