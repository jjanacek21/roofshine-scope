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
  raw: null,
  gc_roof_measurement_id: null,
};

export const CB_LINEAR_FIELDS: { key: keyof CbMeasurement; label: string }[] = [
  { key: "ridge_lf", label: "Ridge" },
  { key: "hip_lf", label: "Hip" },
  { key: "valley_lf", label: "Valley" },
  { key: "rake_lf", label: "Rake" },
  { key: "eave_lf", label: "Eave" },
  { key: "drip_edge_lf", label: "Drip edge" },
  { key: "starter_lf", label: "Starter" },
  { key: "ridge_cap_lf", label: "Ridge cap" },
  { key: "wall_flashing_lf", label: "Wall flashing" },
  { key: "step_flashing_lf", label: "Step flashing" },
  { key: "gutter_lf", label: "Gutter" },
];

export type CbMeasureCredit = { allowed: boolean; metered: boolean; remaining: number | null };

export type CbInstantResult =
  | { ok: true; measurement: CbMeasurement; credit: CbMeasureCredit }
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
}: {
  address: string;
  lat: number | null;
  lng: number | null;
  workspaceId: string;
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
  if (lat == null || lng == null) return { ok: false, reason: "no_coordinates", credit };

  try {
    const res = await cbInstantMeasureFn({
      data: { workspace_id: workspaceId, address: address ?? "", lat, lng },
    });
    if (!res.ok) return { ok: false, reason: res.reason ?? "failed", credit };
    return {
      ok: true,
      credit,
      measurement: {
        ...res.measurement,
        raw: res.measurement,
        gc_roof_measurement_id: res.roof_measurement_id ?? null,
      } as CbMeasurement,
    };
  } catch {
    return { ok: false, reason: "engine_error", credit };
  }
}

/** Upsert cb_measurements (unique on job_id) and pre-fill the takeoff sheet. */
export async function saveCbMeasurement(
  jobId: string,
  m: CbMeasurement,
  repAdjusted: boolean,
): Promise<void> {
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
      source: m.source,
      gc_roof_measurement_id: m.gc_roof_measurement_id ?? null,
      rep_adjusted: repAdjusted,
      raw: (m.raw ?? null) as never,
    },
    { onConflict: "job_id" },
  );
  if (error) throw error;

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
        CB_LINEAR_FIELDS.map((f) => [f.key, m[f.key] as number]),
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
  if (tErr) throw tErr;
}
