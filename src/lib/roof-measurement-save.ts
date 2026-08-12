/**
 * Shared roof measurement math + persistence.
 *
 * Both the GlobalContractor job flow (SolarRoofTab.persistPins) and Claim Buddy
 * (cbInstantMeasureFn) use these helpers so squares / plan area / actual area /
 * predominant pitch can never drift between the two surfaces.
 */
import { pitchMultiplier, withWaste } from "@/lib/roof-math";

export type MeasuredFacet = {
  ring?: number[][] | null;
  pitch: string;
  plan_area_sqft: number;
  /** Flat roofs never get a pitch multiplier. */
  flat?: boolean;
};

export const SECTION_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
];

export function isPitchString(p: string | null | undefined): boolean {
  return !!p && /^\d+\s*\/\s*\d+$/.test(p);
}

export function facetMultiplier(f: { pitch: string; flat?: boolean }): number {
  if (f.flat) return 1;
  return isPitchString(f.pitch) ? pitchMultiplier(f.pitch) : 1;
}

/** Plan area, pitch-adjusted (actual) area, squares with waste, predominant pitch. */
export function roofTotals(facets: MeasuredFacet[], wastePct: number) {
  const planTotal = facets.reduce((s, f) => s + (f.plan_area_sqft || 0), 0);
  const slopedTotal = facets.reduce(
    (s, f) => s + (f.plan_area_sqft || 0) * facetMultiplier(f),
    0,
  );
  const byPitch: Record<string, number> = {};
  for (const f of facets) {
    const p = f.flat ? "0/12" : f.pitch;
    if (!p) continue;
    byPitch[p] = (byPitch[p] ?? 0) + (f.plan_area_sqft || 0);
  }
  const predominant = Object.entries(byPitch).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    planTotal,
    slopedTotal,
    squares: withWaste(slopedTotal, wastePct) / 100,
    predominantPitch: isPitchString(predominant) ? predominant : null,
  };
}

type MinimalClient = {
  from: (t: string) => any;
};

/**
 * Upsert one roof_measurements row for the property and replace its
 * roof_sections rows — identical shape to the GC job flow's persistPins.
 */
export async function saveSolarMeasurement(
  client: MinimalClient,
  args: {
    propertyId: string;
    companyId: string;
    createdBy?: string | null;
    runId?: string | null;
    wastePct: number;
    facets: MeasuredFacet[];
    namePrefix?: string;
  },
): Promise<{ ok: true; measurementId: string } | { ok: false; reason: string }> {
  const facets = args.facets.filter((f) => (f.plan_area_sqft || 0) > 0);
  if (facets.length === 0) return { ok: false, reason: "no_facets" };

  const totals = roofTotals(facets, args.wastePct);

  const { data: m, error: mErr } = await client
    .from("roof_measurements")
    .upsert(
      {
        property_id: args.propertyId,
        company_id: args.companyId,
        source: "google_solar" as const,
        predominant_pitch: totals.predominantPitch,
        waste_pct: args.wastePct,
        total_area_sqft: totals.slopedTotal,
        squares: totals.squares,
        created_by: args.createdBy ?? null,
        ai_run_id: args.runId ?? null,
        ai_geometry: {
          total_plan_sqft: totals.planTotal,
          facets: facets.map((f) => ({
            ring: f.ring ?? null,
            pitch: f.pitch,
            plan_area_sqft: f.plan_area_sqft,
          })),
        },
      },
      { onConflict: "property_id" },
    )
    .select("id")
    .single();
  if (mErr || !m) return { ok: false, reason: mErr?.message ?? "measurement_failed" };

  await client.from("roof_sections").delete().eq("measurement_id", m.id);

  const rows = facets
    .filter((f) => (f.ring?.length ?? 0) >= 3)
    .map((f, i) => {
      const ring = f.ring as number[][];
      const closed =
        ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
          ? ring
          : [...ring, ring[0]];
      const pitch = f.flat ? "0/12" : f.pitch;
      const mult = facetMultiplier(f);
      return {
        measurement_id: m.id,
        name: `${args.namePrefix ?? "Facet"} ${i + 1}`,
        color: SECTION_COLORS[i % SECTION_COLORS.length],
        polygon_geojson: { type: "Polygon" as const, coordinates: [closed] },
        plan_area_sqft: f.plan_area_sqft,
        pitch,
        pitch_multiplier: mult,
        actual_area_sqft: f.plan_area_sqft * mult,
        sort_order: i,
      };
    });

  if (rows.length > 0) {
    await client.from("roof_sections").insert(rows);
  }

  return { ok: true, measurementId: m.id as string };
}
