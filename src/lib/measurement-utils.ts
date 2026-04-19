import * as turf from "@turf/turf";
import type { Feature, Polygon, LineString, Point } from "geojson";
import { type EdgeType } from "@/lib/roof-math";
import { type PenetrationType } from "@/lib/mapbox-draw-styles";
import type { MeasurementTotals } from "@/components/roof/MeasurementTotalsPanel";

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
  penetration_type?: PenetrationType;
};

export type AnyFeature = Feature<Polygon | LineString | Point, FeatureProps>;

export function computeTotals(features: AnyFeature[]): MeasurementTotals {
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
  const pitchSamples: number[] = []; // [rise]

  for (const p of polygons) {
    const flatM = turf.area(p);
    const flatFt = flatM * SQM_TO_SQFT;
    flatSqft += flatFt;
    const pitch = p.properties?.pitch ?? "6/12";
    slopedSqft += flatFt * pitchMultiplier(pitch);
    const rise = parseInt(pitch.split("/")[0] ?? "6", 10);
    if (!Number.isNaN(rise)) pitchSamples.push(rise);
  }

  const edges: Partial<Record<EdgeType, number>> = {};
  for (const l of lines) {
    const lengthFt = turf.length(l, { units: "kilometers" }) * KM_TO_FT;
    const t = l.properties?.edge_type;
    if (t) edges[t] = (edges[t] ?? 0) + lengthFt;
  }

  const penetrations: Partial<Record<PenetrationType, number>> = {};
  for (const pt of points) {
    const t = pt.properties?.penetration_type;
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
  };
}
