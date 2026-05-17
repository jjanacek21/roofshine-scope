import * as turf from "@turf/turf";
import type { Feature, Polygon, LineString, Point } from "geojson";
import { type EdgeType } from "@/lib/roof-math";
import { type PenetrationType } from "@/lib/mapbox-draw-styles";
import type { MeasurementTotals, SectionTotal } from "@/components/roof/MeasurementTotalsPanel";

const SQM_TO_SQFT = 10.7639;
const KM_TO_FT = 3280.84;

export function pitchMultiplier(pitch: string): number {
  const m = pitch.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return 1;
  const rise = Number(m[1]);
  const run = Number(m[2]);
  if (run === 0) return 1;
  return Math.sqrt(1 + (rise / run) ** 2);
}

export type FeatureProps = {
  pitch?: string;
  edge_type?: EdgeType;
  user_color?: string;
  is_perimeter?: boolean;
  penetration_type?: PenetrationType;
  // Per-section metadata (polygons only)
  section_name?: string;
  section_color?: string;
  section_waste_pct?: number;
  // Per-segment perimeter labels (polygons only). Indexed by segment 0..N-1
  // where N = ring.length - 1 (closed-ring last vertex is the same as first).
  // null means "unlabeled". Stored as an array of strings for GeoJSON safety.
  perimeter_edges?: (EdgeType | null)[];
};

export type AnyFeature = Feature<Polygon | LineString | Point, FeatureProps>;

// Rotating palette for new sections
export const SECTION_COLORS = [
  "#1e90ff", // blue
  "#f59e0b", // amber
  "#10b981", // emerald
  "#a855f7", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

export function nextSectionColor(index: number): string {
  return SECTION_COLORS[index % SECTION_COLORS.length];
}

export function computeTotals(features: AnyFeature[], defaultWastePct = 15): MeasurementTotals {
  const polygons = features.filter(
    (f): f is Feature<Polygon, FeatureProps> => f.geometry.type === "Polygon",
  );
  const lines = features.filter(
    (f): f is Feature<LineString, FeatureProps> => f.geometry.type === "LineString",
  );
  const points = features.filter(
    (f): f is Feature<Point, FeatureProps> => f.geometry.type === "Point",
  );

  let flatSqft = 0;
  let slopedSqft = 0;
  const pitchSamples: number[] = [];

  const sections: SectionTotal[] = [];

  // Auto-close: if the user only drew lines (no polygons), try to derive the
  // outer perimeter polygon(s) from connected line endpoints via turf.polygonize.
  // These are added as synthetic sections so area math still works.
  const derivedPolygons: Feature<Polygon, FeatureProps>[] = [];
  if (polygons.length === 0 && lines.length >= 3) {
    try {
      const fc = {
        type: "FeatureCollection" as const,
        features: lines.map((l) => ({
          ...l,
          properties: l.properties ?? {},
        })),
      };
      // turf.polygonize finds all closed cycles formed by the line set.
      const polyFc = turf.polygonize(fc as never) as { features: Feature<Polygon>[] };
      for (const p of polyFc.features) {
        derivedPolygons.push({
          ...p,
          properties: { pitch: "6/12", section_name: "Roof", section_color: "#1e90ff" },
        } as Feature<Polygon, FeatureProps>);
      }
    } catch {
      // polygonize throws if the lines don't form closed rings — that's fine.
    }
  }
  const allPolygons = polygons.length ? polygons : derivedPolygons;

  allPolygons.forEach((p, i) => {
    const flatM = turf.area(p);
    const flatFt = flatM * SQM_TO_SQFT;
    const pitch = p.properties?.pitch ?? "6/12";
    const mult = pitchMultiplier(pitch);
    const slopedFt = flatFt * mult;
    flatSqft += flatFt;
    slopedSqft += slopedFt;
    const rise = parseInt(pitch.split("/")[0] ?? "6", 10);
    if (!Number.isNaN(rise)) pitchSamples.push(rise);

    sections.push({
      id: String(p.id ?? `idx-${i}`),
      name: p.properties?.section_name ?? `Roof ${i + 1}`,
      color: p.properties?.section_color ?? nextSectionColor(i),
      pitch,
      pitch_multiplier: mult,
      plan_area_sqft: flatFt,
      sloped_area_sqft: slopedFt,
      squares: flatFt / 100,
      sloped_squares: slopedFt / 100,
      waste_pct: p.properties?.section_waste_pct ?? defaultWastePct,
    });
  });

  const edges: Partial<Record<EdgeType, number>> = {};
  for (const l of lines) {
    const lengthFt = turf.length(l, { units: "kilometers" }) * KM_TO_FT;
    const t = l.properties?.edge_type as EdgeType | undefined;
    if (t) edges[t] = (edges[t] ?? 0) + lengthFt;
  }

  // Add perimeter segment labels from polygons (eave / rake / etc.)
  for (const p of polygons) {
    const ring = p.geometry.coordinates[0];
    const labels = p.properties?.perimeter_edges ?? [];
    for (let i = 0; i < ring.length - 1; i++) {
      const t = labels[i];
      if (!t) continue;
      const seg = turf.lineString([ring[i], ring[i + 1]]);
      const lf = turf.length(seg, { units: "kilometers" }) * KM_TO_FT;
      edges[t] = (edges[t] ?? 0) + lf;
    }
  }

  const penetrations: Partial<Record<PenetrationType, number>> = {};
  for (const pt of points) {
    const t = pt.properties?.penetration_type as PenetrationType | undefined;
    if (t) penetrations[t] = (penetrations[t] ?? 0) + 1;
  }

  const avgRise = pitchSamples.length
    ? Math.round(pitchSamples.reduce((s, x) => s + x, 0) / pitchSamples.length)
    : 0;

  return {
    total_area_sqft: flatSqft,
    sloped_area_sqft: slopedSqft,
    squares: flatSqft / 100,
    sloped_squares: slopedSqft / 100,
    avg_pitch: avgRise > 0 ? `${avgRise}/12` : "—",
    edges,
    penetrations,
    sections,
  };
}
