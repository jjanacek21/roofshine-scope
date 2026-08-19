/**
 * Property-scoped roof plan storage.
 *
 * Claim Buddy stores its plan against a job (cb_* RPCs). GlobalContractor
 * stores the same shape against a property, in roof_measurements ->
 * roof_sections / roof_edges / roof_lines. Both surfaces render with
 * CbRoofPlanEditor, so both need the same CbPlan in and out — this module is
 * the GlobalContractor half of that.
 *
 * See docs/MEASUREMENT_INVARIANTS.md: one closed outline per structure.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  cbSectionColor,
  closeRing,
  lineLengthFeet,
  normalizeEdges,
  openRing,
  planTotals,
  sectionEdgeLengths,
  sectionPlanAreaSqft,
  type CbEdgeType,
  type CbPlan,
  type CbPlanTotals,
} from "@/lib/cbRoofPlan";
import { pitchMultiplier, type EdgeType } from "@/lib/roof-math";

type GeoPolygon = { type: string; coordinates: number[][][] } | null;
type GeoLine = { type: string; coordinates: number[][] } | null;

function ringOf(geo: GeoPolygon): number[][] {
  const ring = geo?.coordinates?.[0] ?? [];
  return openRing(ring.filter((p) => Array.isArray(p) && p.length >= 2));
}

export interface LoadedRoofPlan {
  measurementId: string | null;
  plan: CbPlan;
  wastePct: number;
}

export async function loadRoofPlan(propertyId: string): Promise<LoadedRoofPlan> {
  const { data: measurement } = await supabase
    .from("roof_measurements")
    .select("id, waste_pct")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (!measurement) return { measurementId: null, plan: { sections: [], lines: [] }, wastePct: 15 };

  const [sectionsRes, linesRes] = await Promise.all([
    supabase
      .from("roof_sections")
      .select("*, roof_edges(*)")
      .eq("measurement_id", measurement.id)
      .order("sort_order"),
    supabase.from("roof_lines").select("*").eq("measurement_id", measurement.id),
  ]);

  const sections = (sectionsRes.data ?? []).map((s, i) => {
    const ring = ringOf(s.polygon_geojson as GeoPolygon);
    const edges = ((s.roof_edges ?? []) as { edge_index: number; edge_type: EdgeType }[])
      .slice()
      .sort((a, b) => a.edge_index - b.edge_index)
      .map((e) => e.edge_type as CbEdgeType);
    return {
      id: s.id,
      name: s.name || `Structure ${i + 1}`,
      color: s.color || cbSectionColor(i),
      ring,
      pitch: s.pitch || "6/12",
      edges: normalizeEdges(ring, edges),
      structureKey: s.structure_key || s.id,
      pin:
        s.pin_lat != null && s.pin_lng != null
          ? { lat: Number(s.pin_lat), lng: Number(s.pin_lng) }
          : null,
      isLocked: !!s.is_locked,
      aiRing: s.ai_polygon_geojson ? ringOf(s.ai_polygon_geojson as GeoPolygon) : null,
    };
  });

  const lines = (linesRes.data ?? []).map((l) => ({
    id: l.id,
    coords: ((l.line_geojson as GeoLine)?.coordinates ?? []) as number[][],
    type: l.line_type as CbEdgeType,
  }));

  return {
    measurementId: measurement.id,
    plan: { sections: sections.filter((s) => s.ring.length >= 3), lines },
    wastePct: Number(measurement.waste_pct ?? 15),
  };
}

/** Replace the stored plan for a property and refresh the rolled-up totals. */
export async function saveRoofPlan(opts: {
  propertyId: string;
  companyId: string;
  userId?: string | null;
  plan: CbPlan;
  wastePct: number;
}): Promise<CbPlanTotals> {
  const { propertyId, companyId, userId, plan, wastePct } = opts;
  const totals = planTotals(plan);
  const wasteMult = 1 + Number(wastePct || 0) / 100;

  const { data: m, error: mErr } = await supabase
    .from("roof_measurements")
    .upsert(
      {
        property_id: propertyId,
        company_id: companyId,
        source: "mapbox_draw" as const,
        predominant_pitch: totals.pitch,
        waste_pct: wastePct,
        total_area_sqft: totals.total_area_sqft,
        squares: (totals.total_area_sqft / 100) * wasteMult,
        eaves_lf: totals.eave_lf,
        rakes_lf: totals.rake_lf,
        ridges_lf: totals.ridge_lf,
        hips_lf: totals.hip_lf,
        valleys_lf: totals.valley_lf,
        gutters_lf: totals.gutter_lf,
        wall_flashing_lf: totals.wall_flashing_lf,
        step_flashing_lf: totals.step_flashing_lf,
        created_by: userId ?? null,
      },
      { onConflict: "property_id" },
    )
    .select("id")
    .single();
  if (mErr) throw mErr;

  await supabase.from("roof_sections").delete().eq("measurement_id", m.id);
  await supabase.from("roof_lines").delete().eq("measurement_id", m.id);

  for (let i = 0; i < plan.sections.length; i++) {
    const s = plan.sections[i];
    const planArea = sectionPlanAreaSqft(s);
    const mult = pitchMultiplier(s.pitch);
    const lens = sectionEdgeLengths(s);
    const edges = normalizeEdges(s.ring, s.edges);

    const { data: row, error } = await supabase
      .from("roof_sections")
      .insert({
        measurement_id: m.id,
        name: s.name,
        color: s.color,
        polygon_geojson: { type: "Polygon", coordinates: [closeRing(s.ring)] },
        plan_area_sqft: Math.round(planArea),
        pitch: s.pitch,
        pitch_multiplier: Math.round(mult * 1000) / 1000,
        actual_area_sqft: Math.round(planArea * mult),
        sort_order: i,
        structure_key: s.structureKey || null,
        pin_lat: s.pin?.lat ?? null,
        pin_lng: s.pin?.lng ?? null,
        is_locked: s.isLocked,
        ai_polygon_geojson: s.aiRing?.length
          ? { type: "Polygon", coordinates: [closeRing(s.aiRing)] }
          : null,
      })
      .select("id")
      .single();
    if (error) throw error;

    const edgeRows = edges
      .map((t, idx) => ({
        section_id: row.id,
        edge_index: idx,
        edge_type: t as EdgeType,
        length_lf: Math.round((lens[idx] ?? 0) * 10) / 10,
      }))
      .filter((e) => (e.edge_type as CbEdgeType) !== "unlabeled");
    if (edgeRows.length) {
      const { error: eErr } = await supabase.from("roof_edges").insert(edgeRows);
      if (eErr) throw eErr;
    }
  }

  const lineRows = plan.lines
    .filter((l) => l.type !== "unlabeled" && l.coords.length >= 2)
    .map((l) => ({
      measurement_id: m.id,
      line_geojson: { type: "LineString", coordinates: l.coords },
      line_type: l.type as EdgeType,
      length_lf: Math.round(lineLengthFeet(l.coords) * 10) / 10,
    }));
  if (lineRows.length) {
    const { error: lErr } = await supabase.from("roof_lines").insert(lineRows);
    if (lErr) throw lErr;
  }

  return totals;
}
