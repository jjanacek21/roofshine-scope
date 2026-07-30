import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Scans an entire property with Google Solar by probing the center + a ring
// of offset points. Deduplicates buildings by centroid distance so a house
// AND its shed / detached garage each get their own facet.

type SolarSeg = {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  stats?: { areaMeters2?: number };
  boundingBox?: {
  sw: { latitude: number; longitude: number };
  ne: { latitude: number; longitude: number };
  };
  center?: { latitude: number; longitude: number };
};
type SolarResponse = {
  solarPotential?: {
  wholeRoofStats?: { areaMeters2?: number };
  roofSegmentStats?: SolarSeg[];
  };
  imageryQuality?: string;
};

const M_PER_DEG_LAT = 111_320;
const SQ_M_TO_SQ_FT = 10.7639;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
  Math.sin(dLat / 2) ** 2 +
  Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function fetchBuilding(
  lat: number,
  lng: number,
  quality: "HIGH" | "MEDIUM" | "LOW",
  apiKey: string,
): Promise<SolarResponse | null> {
  const url =
  `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
  `?location.latitude=${lat}&location.longitude=${lng}` +
  `&requiredQuality=${quality}&key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return (await r.json()) as SolarResponse;
}

function pitchStrFromDeg(deg: number): string {
  const rise = Math.round(Math.tan((deg * Math.PI) / 180) * 12);
  return `${Math.max(0, Math.min(12, rise))}/12`;
}
function pitchMultFromDeg(deg: number): number {
  const rise = Math.tan((deg * Math.PI) / 180) * 12;
  return Math.sqrt(1 + Math.pow(rise / 12, 2));
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type AutoMeasureResult =
  | { ok: true; structures: number; facets: number; total_plan_sqft: number; total_actual_sqft: number; squares: number; predominant_pitch: string }
  | { ok: false; reason: "google_key_missing" | "no_property" | "no_coordinates" | "already_measured" | "no_coverage" | "no_segments" };

export async function runAutoMeasure(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
): Promise<AutoMeasureResult> {
  const { data: job } = await supabase
    .from("jobs")
    .select("id, property_id, company_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job?.property_id) return { ok: false, reason: "no_property" };
  return runAutoMeasureForProperty(supabase, userId, job.property_id, job.company_id);
}

/**
 * Core measurement pipeline, keyed on a property. Used by the job flow and by
 * the storm canvassing map — there is only ever one pipeline.
 */
export async function runAutoMeasureForProperty(
  supabase: SupabaseClient,
  userId: string,
  propertyId: string,
  companyId: string | null,
  opts?: {
    /** Measure only the building under the point — no offset probe ring. */
    single?: boolean;
    /** Optional footprint bbox [minLng, minLat, maxLng, maxLat] to clip facets to. */
    footprint?: [number, number, number, number] | null;
    /** Overwrite an existing google_solar measurement. */
    force?: boolean;
  },
): Promise<AutoMeasureResult> {
  const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!GOOGLE_KEY) return { ok: false, reason: "google_key_missing" };

  const { data: prop } = await supabase
    .from("properties")
    .select("id, lat, lng, company_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!prop?.lat || !prop?.lng) return { ok: false, reason: "no_coordinates" as const };
  const resolvedCompanyId = companyId ?? prop.company_id;

  // Skip if a measurement already exists (don't overwrite user-verified work).
  const { data: existing } = await supabase
    .from("roof_measurements")
    .select("id, source")
    .eq("property_id", prop.id)
    .maybeSingle();
  if (existing && existing.source !== "google_solar" && !opts?.force) {
    return { ok: false, reason: "already_measured" as const };
  }


  // Probe center + 8 surrounding points at ~25m, then 4 corners at ~50m.
  const lat = Number(prop.lat);
  const lng = Number(prop.lng);
  const dLat25 = 25 / M_PER_DEG_LAT;
  const dLng25 = dLat25 / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const dLat50 = 50 / M_PER_DEG_LAT;
  const dLng50 = dLat50 / Math.max(0.1, Math.cos((lat * Math.PI) / 180));

  const probes: Array<{ lat: number; lng: number }> = opts?.single
    ? [{ lat, lng }]
    : [
    { lat, lng },
    { lat: lat + dLat25, lng }, { lat: lat - dLat25, lng },
    { lat, lng: lng + dLng25 }, { lat, lng: lng - dLng25 },
    { lat: lat + dLat25, lng: lng + dLng25 }, { lat: lat + dLat25, lng: lng - dLng25 },
    { lat: lat - dLat25, lng: lng + dLng25 }, { lat: lat - dLat25, lng: lng - dLng25 },
    { lat: lat + dLat50, lng: lng + dLng50 }, { lat: lat + dLat50, lng: lng - dLng50 },
    { lat: lat - dLat50, lng: lng + dLng50 }, { lat: lat - dLat50, lng: lng - dLng50 },
  ];


  // Fetch all probes in parallel (cheap: buildingInsights is a single GET).
  const results = await Promise.all(
    probes.map(async (p) => {
      for (const q of ["HIGH", "MEDIUM", "LOW"] as const) {
        const r = await fetchBuilding(p.lat, p.lng, q, GOOGLE_KEY);
        if (r?.solarPotential?.roofSegmentStats?.length) return r;
      }
      return null;
    }),
  );

  // Deduplicate detected buildings: group segments by building centroid.
  type Building = { center: { lat: number; lng: number }; segments: SolarSeg[]; imageryQuality: string };
  const buildings: Building[] = [];
  const DEDUP_METERS = 12;

  for (const res of results) {
    const segs = res?.solarPotential?.roofSegmentStats ?? [];
    if (!segs.length) continue;
    const c0 = segs[0]?.center;
    if (!c0) continue;
    const center = { lat: c0.latitude, lng: c0.longitude };
    const near = buildings.find((b) => haversineMeters(b.center, center) < DEDUP_METERS);
    if (near) continue;
    buildings.push({ center, segments: segs, imageryQuality: res?.imageryQuality ?? "MEDIUM" });
  }

  if (buildings.length === 0) return { ok: false, reason: "no_coverage" as const };

  // Single-house mode: keep only the building nearest the clicked point, and
  // drop any facet whose centre falls outside the clicked footprint.
  if (opts?.single) {
    buildings.sort(
      (a, b) => haversineMeters(a.center, { lat, lng }) - haversineMeters(b.center, { lat, lng }),
    );
    buildings.splice(1);
    const fp = opts.footprint;
    if (fp) {
      const [minLng, minLat, maxLng, maxLat] = fp;
      const pad = 0.00012; // ~13 m of slack around the footprint bbox
      const b = buildings[0];
      const inside = b.segments.filter((s) => {
        const c = s.center;
        if (!c) return true;
        return (
          c.longitude >= minLng - pad &&
          c.longitude <= maxLng + pad &&
          c.latitude >= minLat - pad &&
          c.latitude <= maxLat + pad
        );
      });
      if (inside.length) b.segments = inside;
    }
  }


  // Build a single roof_measurements row + one roof_sections row per facet
  // across ALL detected buildings (house + shed + garage, etc.).
  let totalPlan = 0;
  let totalActual = 0;
  const pitchTotals: Record<string, number> = {};
  type SectionRow = {
    name: string;
    color: string;
    polygon_geojson: { type: "Polygon"; coordinates: number[][][] };
    plan_area_sqft: number;
    pitch: string;
    pitch_multiplier: number;
    actual_area_sqft: number;
    sort_order: number;
  };
  const sectionRows: SectionRow[] = [];
  const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];
  let sortIdx = 0;

  buildings.forEach((b, bi) => {
    const label = bi === 0 ? "House" : `Structure ${bi + 1}`;
    b.segments.forEach((seg, si) => {
      const planM2 = seg.stats?.areaMeters2 ?? 0;
      if (planM2 <= 0 || !seg.boundingBox) return;
      const planSqFt = planM2 * SQ_M_TO_SQ_FT;
      const pitchDeg = seg.pitchDegrees ?? 0;
      const mult = pitchMultFromDeg(pitchDeg);
      const pitchStr = pitchStrFromDeg(pitchDeg);
      const actual = planSqFt * mult;
      totalPlan += planSqFt;
      totalActual += actual;
      pitchTotals[pitchStr] = (pitchTotals[pitchStr] ?? 0) + planSqFt;
      const bb = seg.boundingBox;
      // Google returns an axis-aligned bounding box for each roof segment. On a
      // hipped or diagonally-oriented roof that box is far larger than the facet
      // itself and overlaps neighbouring houses. Shrink it around the segment
      // centre until its ground area matches the reported plan area.
      const cLat = seg.center?.latitude ?? (bb.sw.latitude + bb.ne.latitude) / 2;
      const cLng = seg.center?.longitude ?? (bb.sw.longitude + bb.ne.longitude) / 2;
      const mPerDegLng = M_PER_DEG_LAT * Math.max(0.1, Math.cos((cLat * Math.PI) / 180));
      let halfLat = Math.abs(bb.ne.latitude - bb.sw.latitude) / 2;
      let halfLng = Math.abs(bb.ne.longitude - bb.sw.longitude) / 2;
      const boxM2 = halfLat * 2 * M_PER_DEG_LAT * (halfLng * 2 * mPerDegLng);
      if (boxM2 > 0 && planM2 > 0 && boxM2 > planM2) {
        const k = Math.sqrt(planM2 / boxM2);
        halfLat *= k;
        halfLng *= k;
      }
      const ring = [
        [cLng - halfLng, cLat - halfLat],
        [cLng + halfLng, cLat - halfLat],
        [cLng + halfLng, cLat + halfLat],
        [cLng - halfLng, cLat + halfLat],
        [cLng - halfLng, cLat - halfLat],
      ];

      sectionRows.push({
        name: b.segments.length > 1 ? `${label} · Facet ${si + 1}` : label,
        color: COLORS[bi % COLORS.length],
        polygon_geojson: { type: "Polygon", coordinates: [ring] },
        plan_area_sqft: Math.round(planSqFt),
        pitch: pitchStr,
        pitch_multiplier: Number(mult.toFixed(4)),
        actual_area_sqft: Math.round(actual),
        sort_order: sortIdx++,
      });
    });
  });

  if (sectionRows.length === 0) return { ok: false, reason: "no_segments" as const };

  const predominant =
    Object.entries(pitchTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "6/12";
  const wastePct = 15;
  const squares = (totalActual * (1 + wastePct / 100)) / 100;

  // Upsert measurement
  const payload = {
    property_id: prop.id,
    company_id: resolvedCompanyId,
    source: "google_solar" as const,
    predominant_pitch: predominant,
    waste_pct: wastePct,
    total_area_sqft: Math.round(totalActual),
    squares: Number(squares.toFixed(2)),
    eaves_lf: 0,
    rakes_lf: 0,
    ridges_lf: 0,
    hips_lf: 0,
    valleys_lf: 0,
    gutters_lf: 0,
    wall_flashing_lf: 0,
    step_flashing_lf: 0,
    transition_lf: 0,
    created_by: userId,
    ai_analysis: {
      auto_scan: true,
      structures_detected: buildings.length,
      facets_detected: sectionRows.length,
      scanned_at: new Date().toISOString(),
    },
  };
  const { data: m, error: mErr } = await supabase
    .from("roof_measurements")
    .upsert(payload, { onConflict: "property_id" })
    .select("id")
    .single();
  if (mErr || !m) throw new Error(mErr?.message ?? "Failed to save measurement");

  // Replace facets
  await supabase.from("roof_sections").delete().eq("measurement_id", m.id);
  const inserts = sectionRows.map((r) => ({ ...r, measurement_id: m.id }));
  const { error: sErr } = await supabase.from("roof_sections").insert(inserts);
  if (sErr) throw new Error(sErr.message);

  return {
    ok: true as const,
    structures: buildings.length,
    facets: sectionRows.length,
    total_plan_sqft: Math.round(totalPlan),
    total_actual_sqft: Math.round(totalActual),
    squares: Number(squares.toFixed(2)),
    predominant_pitch: predominant,
  };
}

export const autoMeasureJobProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { job_id: string }) => input)
  .handler(async ({ data, context }) => {
    return runAutoMeasure(context.supabase, context.userId, data.job_id);
  });

/**
 * Same pipeline, keyed on a property instead of a job. Used by the storm
 * canvassing map so a house can be measured before it becomes a job.
 */
export const autoMeasurePropertyRoof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      property_id: string;
      single?: boolean;
      footprint?: [number, number, number, number] | null;
      force?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    return runAutoMeasureForProperty(context.supabase, context.userId, data.property_id, null, {
      single: data.single,
      footprint: data.footprint ?? null,
      force: data.force,
    });

  });
