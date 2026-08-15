import type { SupabaseClient } from "@supabase/supabase-js";

export type CbInstantMeasureInput = {
  workspace_id: string;
  /** Claim Buddy job — binds the trace to the SAME roof_measurements row the plan editor reads. */
  job_id: string;
  address: string;
  lat?: number;
  lng?: number;
  /** Exact roof points tapped by the rep. One point per structure. */
  pins?: Array<{ lat: number; lng: number }>;
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
  const { traceRoofFromPin } = await import("@/lib/roof-vision-trace.server");
  const { polygonAreaSqft } = await import("@/lib/roof-math");
  const { regularizeRing } = await import("@/lib/roof-regularize");

  /**
   * Buildings are rectilinear: snap the traced outline onto its own dominant
   * axis so a shadow bulge becomes a straight run. Area moves are reported so
   * the estimate never changes silently.
   */
  const regularization: Array<{ delta_pct: number; flagged: boolean }> = [];
  const squareUp = (ring: number[][]): number[][] => {
    try {
      const r = regularizeRing(ring);
      if (r.ring.length < 3) return ring;
      regularization.push({
        delta_pct: Math.round(r.areaDeltaPct * 100) / 100,
        flagged: r.flagged,
      });
      return r.ring;
    } catch {
      return ring;
    }
  };

  const pins = (data.pins?.length
    ? data.pins
    : data.lat != null && data.lng != null
      ? [{ lat: data.lat, lng: data.lng }]
      : [])
    .map((pin) => ({ lat: Number(pin.lat), lng: Number(pin.lng) }))
    .filter((pin) => Number.isFinite(pin.lat) && Number.isFinite(pin.lng));
  if (pins.length === 0) return { ok: false as const, reason: "no_pin" };

  /*
   * Resolve the property/company through the SAME RPC the roof plan editor
   * uses (cb_ensure_roof_measurement). Deriving them any other way produced a
   * second property row under a different company, so the traced facets landed
   * on a measurement the plan editor never read — the screen looked empty and
   * the rep had to hand-draw a box.
   */
  const { data: rmId, error: rmErr } = await supabase.rpc("cb_ensure_roof_measurement", {
    _job: data.job_id,
  });
  if (rmErr || !rmId) return { ok: false as const, reason: "no_property" };

  const { data: rm } = await supabaseAdmin
    .from("roof_measurements")
    .select("id, property_id, company_id")
    .eq("id", rmId as string)
    .maybeSingle();
  if (!rm?.property_id || !rm.company_id) return { ok: false as const, reason: "no_property" };

  const propertyId = rm.property_id as string;
  const companyId = rm.company_id as string;

  // Keep the property row's coordinates in sync with the rep's primary roof pin.
  const primaryPin = pins[0];
  await supabaseAdmin
    .from("properties")
    .update({ lat: primaryPin.lat, lng: primaryPin.lng, address: data.address || undefined })
    .eq("id", propertyId);

  type ExtractedSegment = {
    ring: number[][];
    pitch: string;
    plan_area_sqft: number;
  };

  // Run the exact GC engine once per structure pin, then save all returned
  // facets as one property measurement. Empty/failed pins never become boxes.
  const segments: ExtractedSegment[] = [];
  const sources: Array<{ footprint: string | null; facet: string | null }> = [];
  const traceConfidence: number[] = [];
  let runId: string | null = null;
  let firstFailure = "no_footprint";
  for (const pin of pins) {
    const extract = await runSolarRoofExtract({
      supabase,
      userId,
      lat: pin.lat,
      lng: pin.lng,
      property_id: propertyId,
      job_id: data.job_id,
    });
    if (extract.status !== 200) {
      firstFailure =
        (extract.body?.error as string | undefined) ??
        (extract.status === 404 ? "no_coverage" : "measure_failed");
      continue;
    }
    const traced = ((extract.body.segments ?? []) as ExtractedSegment[]).filter(
      (segment) => (segment.ring?.length ?? 0) >= 3 && segment.plan_area_sqft > 0,
    );
    if (traced.length === 0) continue;
    const candidate = (extract.body.footprint as number[][] | undefined) ?? traced[0]?.ring ?? null;
    let vision: Awaited<ReturnType<typeof traceRoofFromPin>> = null;
    try {
      vision = await traceRoofFromPin({ lat: pin.lat, lng: pin.lng, candidateRing: candidate });
    } catch (error) {
      console.warn("[cb-measure] vision trace failed", error instanceof Error ? error.message : String(error));
    }
    if (vision) {
      const byPitch = new Map<string, number>();
      traced.forEach((segment) => byPitch.set(segment.pitch, (byPitch.get(segment.pitch) ?? 0) + segment.plan_area_sqft));
      const pitch = [...byPitch.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "6/12";
      const squared = squareUp(vision.ring);
      segments.push({ ring: squared, pitch, plan_area_sqft: polygonAreaSqft(squared) });
      traceConfidence.push(vision.confidence);
    } else if (candidate && candidate.length >= 3) {
      const squared = squareUp(candidate);
      segments.push({
        ring: squared,
        pitch: traced[0]?.pitch ?? "6/12",
        plan_area_sqft: polygonAreaSqft(squared),
      });
      traceConfidence.push(0);
    }
    sources.push({
      footprint: (extract.body.footprint_source as string | null) ?? null,
      facet: (extract.body.facet_source as string | null) ?? null,
    });
    runId ??= (extract.body.run_id as string | null) ?? null;
  }

  /*
   * No traced geometry = no measurement. Never hand back a placeholder shape:
   * a wrong number that looks real is worse than a clear failure.
   */
  if (segments.length === 0) return { ok: false as const, reason: firstFailure };

  const wastePct = Number.isFinite(Number(data.waste_pct)) ? Number(data.waste_pct) : 15;


  const saved = await saveSolarMeasurement(supabaseAdmin, {
    propertyId,
    companyId,
    createdBy: userId,
    runId,
    wastePct,
    facets: segments.map((s) => ({
      ring: s.ring,
      pitch: s.pitch,
      plan_area_sqft: s.plan_area_sqft,
    })),
    namePrefix: "Facet",
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

  /*
   * Perimeter normalisation. The tracer sometimes classes the whole outline as
   * rake (or the whole outline as eave). Perimeter is the truth; split it back
   * so eave + rake always equals the outline and drip edge / starter — which are
   * derived from that sum — never come out short or doubled.
   */
  const rawEave = Number(m.eaves_lf ?? 0);
  const rawRake = Number(m.rakes_lf ?? 0);
  const perimeter = Number(m.drip_edge_lf ?? 0) || rawEave + rawRake;
  let eave = rawEave;
  let rake = rawRake;
  if (perimeter > 0) {
    if (rawEave <= 0 && rawRake > 0) {
      eave = Math.round(Math.max(perimeter - rawRake, perimeter * 0.5) * 10) / 10;
      rake = Math.round((perimeter - eave) * 10) / 10;
    } else if (rawRake <= 0 && rawEave > 0) {
      rake = Math.round(Math.max(perimeter - rawEave, perimeter * 0.5) * 10) / 10;
      eave = Math.round((perimeter - rake) * 10) / 10;
    }
  }
  const perimeterLf = Math.round((eave + rake) * 10) / 10;
  const areaSqft = Number(m.total_area_sqft ?? 0);
  const finalWaste = Number(m.waste_pct ?? wastePct);

  return {
    ok: true as const,
    property_id: propertyId,
    roof_measurement_id: saved.measurementId,
    footprint_source: sources.map((source) => source.footprint).filter(Boolean).join(",") || null,
    facet_source: sources.map((source) => source.facet).filter(Boolean).join(",") || null,
    trace_confidence: traceConfidence,
    regularization,
    measurement: {
      /* squares always carry waste: area x (1 + waste%) / 100 */
      total_squares: Math.round(((areaSqft * (1 + finalWaste / 100)) / 100) * 100) / 100,
      total_area_sqft: areaSqft,
      plan_area_sqft: Number(
        (m.ai_geometry as { total_plan_sqft?: number } | null)?.total_plan_sqft ?? 0,
      ),
      waste_pct: finalWaste,
      pitch: (m.predominant_pitch as string | null) ?? null,
      stories: null as number | null,
      facets: facetCount ?? segments.length,

      ridge_lf: Number(m.ridges_lf ?? 0),
      hip_lf: Number(m.hips_lf ?? 0),
      valley_lf: Number(m.valleys_lf ?? 0),
      rake_lf: rake,
      eave_lf: eave,
      /* derived — perimeter, not a second measurement */
      drip_edge_lf: perimeterLf,
      starter_lf: perimeterLf,
      ridge_cap_lf: Number(m.ridges_lf ?? 0) + Number(m.hips_lf ?? 0),
      wall_flashing_lf: Number(m.wall_flashing_lf ?? 0),
      step_flashing_lf: Number(m.step_flashing_lf ?? 0),
      gutter_lf: Number(m.gutters_lf ?? 0) || eave,
      source: (m.source as string) ?? "google_solar",
    },
  };

}
