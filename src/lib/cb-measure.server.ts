import type { SupabaseClient } from "@supabase/supabase-js";

export type CbInstantMeasureInput = {
  workspace_id: string;
  address: string;
  lat: number;
  lng: number;
  waste_pct?: number;
};

/**
 * Claim Buddy instant measurement — the whole implementation.
 *
 * Runs THE SAME engine as the GlobalContractor job flow: runSolarRoofExtract()
 * from src/lib/solar-extract.server.ts (the code behind POST
 * /api/solar-roof-extract that SolarRoofTab calls), then persists with the same
 * shared math helper the job flow uses (saveSolarMeasurement).
 */
export async function runCbInstantMeasure(
  supabase: SupabaseClient,
  userId: string,
  data: CbInstantMeasureInput,
) {
  // Membership check runs as the caller (RLS scoped).
  const { data: ws } = await supabase
    .from("cb_workspaces")
    .select("id, gc_company_id")
    .eq("id", data.workspace_id)
    .maybeSingle();
  if (!ws) return { ok: false as const, reason: "no_workspace" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runSolarRoofExtract } = await import("@/lib/solar-extract.server");
  const { saveSolarMeasurement } = await import("@/lib/roof-measurement-save");

  let companyId = ws.gc_company_id as string | null;
  if (!companyId) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    companyId = (profile?.company_id as string | null) ?? null;
  }
  if (!companyId) return { ok: false as const, reason: "no_company" };

  // Reuse a nearby property row for this company, otherwise create one.
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  const d = 0.00015;
  const { data: near } = await supabaseAdmin
    .from("properties")
    .select("id")
    .eq("company_id", companyId)
    .gte("lat", lat - d)
    .lte("lat", lat + d)
    .gte("lng", lng - d)
    .lte("lng", lng + d)
    .limit(1);

  let propertyId = near?.[0]?.id as string | undefined;
  if (!propertyId) {
    const { data: created, error } = await supabaseAdmin
      .from("properties")
      .insert({
        company_id: companyId,
        address: data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false as const, reason: "property_failed" };
    propertyId = created.id;
  }

  // ---- THE engine, unchanged, with the job flow's default tuning ----
  const extract = await runSolarRoofExtract({
    supabase: supabase,
    userId: userId,
    lat,
    lng,
    property_id: propertyId,
  });
  if (extract.status !== 200) {
    const reason =
      (extract.body?.error as string | undefined) ??
      (extract.status === 404 ? "no_coverage" : "measure_failed");
    return { ok: false as const, reason };
  }

  const segments = (extract.body.segments ?? []) as Array<{
    ring: number[][];
    pitch: string;
    plan_area_sqft: number;
  }>;
  const wastePct = Number.isFinite(Number(data.waste_pct)) ? Number(data.waste_pct) : 15;

  const saved = await saveSolarMeasurement(supabaseAdmin, {
    propertyId,
    companyId,
    createdBy: userId,
    runId: (extract.body.run_id as string | null) ?? null,
    wastePct,
    facets: segments.map((s) => ({
      ring: s.ring,
      pitch: s.pitch,
      plan_area_sqft: s.plan_area_sqft,
    })),
  });
  if (!saved.ok) return { ok: false as const, reason: saved.reason };

  const { data: m } = await supabaseAdmin
    .from("roof_measurements")
    .select("*")
    .eq("id", saved.measurementId)
    .maybeSingle();
  if (!m) return { ok: false as const, reason: "no_measurement" };

  const { count: facetCount } = await supabaseAdmin
    .from("roof_sections")
    .select("id", { count: "exact", head: true })
    .eq("measurement_id", m.id);

  return {
    ok: true as const,
    property_id: propertyId,
    roof_measurement_id: saved.measurementId,
    measurement: {
      total_squares: Number(m.squares ?? 0),
      total_area_sqft: Number(m.total_area_sqft ?? 0),
      plan_area_sqft: Number(
        (m.ai_geometry as { total_plan_sqft?: number } | null)?.total_plan_sqft ?? 0,
      ),
      waste_pct: Number(m.waste_pct ?? wastePct),
      pitch: (m.predominant_pitch as string | null) ?? null,
      stories: null as number | null,
      facets: facetCount ?? segments.length,
      ridge_lf: Number(m.ridges_lf ?? 0),
      hip_lf: Number(m.hips_lf ?? 0),
      valley_lf: Number(m.valleys_lf ?? 0),
      rake_lf: Number(m.rakes_lf ?? 0),
      eave_lf: Number(m.eaves_lf ?? 0),
      drip_edge_lf:
        Number(m.drip_edge_lf ?? 0) || Number(m.eaves_lf ?? 0) + Number(m.rakes_lf ?? 0),
      starter_lf: Number(m.eaves_lf ?? 0),
      ridge_cap_lf: Number(m.ridges_lf ?? 0) + Number(m.hips_lf ?? 0),
      wall_flashing_lf: Number(m.wall_flashing_lf ?? 0),
      step_flashing_lf: Number(m.step_flashing_lf ?? 0),
      gutter_lf: Number(m.gutters_lf ?? 0) || Number(m.eaves_lf ?? 0),
      source: (m.source as string) ?? "google_solar",
    },
  };
}
