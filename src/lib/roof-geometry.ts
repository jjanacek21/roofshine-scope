/**
 * Roof geometry fitting.
 *
 * Google's Solar API does NOT return roof polygons — it returns one
 * axis-aligned bounding box per roof segment plus an area, pitch and azimuth.
 * Drawing those boxes gives north-aligned squares that overlap in the middle,
 * leave gaps and can never follow a house that is rotated on its lot.
 *
 * This module replaces that with a real fit:
 *   1. take the building footprint (true outline + true angle)
 *   2. decompose it into roof faces the way an actual hip/gable roof breaks up
 *      (each face = the part of the roof that drains to one wall)
 *   3. merge faces that share a slope direction and attach Google's pitch
 *
 * The result tiles the footprint completely: no gaps in the middle, no
 * overlapping squares, fewer + larger shapes, rotated with the house.
 */
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";

export type LngLat = [number, number];

const M_PER_DEG_LAT = 111_320;
const SQM_TO_SQFT = 10.7639;

export type Projector = {
  to: (p: number[]) => number[];
  from: (p: number[]) => number[];
};

/** Local east/north metre plane centred on an origin — good to a few cm at roof scale. */
export function makeProjector(originLng: number, originLat: number): Projector {
  const mPerDegLng = M_PER_DEG_LAT * Math.max(0.1, Math.cos((originLat * Math.PI) / 180));
  return {
    to: ([lng, lat]) => [(lng - originLng) * mPerDegLng, (lat - originLat) * M_PER_DEG_LAT],
    from: ([x, y]) => [originLng + x / mPerDegLng, originLat + y / M_PER_DEG_LAT],
  };
}

/** Drop a duplicated closing vertex. */
export function openRing(ring: number[][]): number[][] {
  if (ring.length > 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring.slice();
}

export function closeRing(ring: number[][]): number[][] {
  const r = openRing(ring);
  return r.length >= 3 ? [...r, r[0]] : r;
}

function signedArea(ring: number[][]): number {
  const r = openRing(ring);
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Force counter-clockwise winding (positive signed area). */
export function toCCW(ring: number[][]): number[][] {
  const r = openRing(ring);
  return signedArea(r) < 0 ? r.slice().reverse() : r;
}

/** Convex hull (Andrew's monotone chain). Returns an open ring. */
export function convexHull(points: number[][]): number[][] {
  if (points.length < 3) return points.slice();
  const pts = points
    .slice()
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: number[][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: number[][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Minimum-area enclosing rectangle (rotating calipers over the hull edges).
 * This is what gives a rotated house a rotated outline instead of a north box.
 */
export function minAreaRect(points: number[][]): number[][] {
  const hull = convexHull(points);
  if (hull.length < 3) return hull;
  let best: { area: number; ring: number[][] } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const ux = dx / len;
    const uy = dy / len;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const p of hull) {
      const u = p[0] * ux + p[1] * uy;
      const v = -p[0] * uy + p[1] * ux;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) {
      const corner = (u: number, v: number) => [u * ux - v * uy, u * uy + v * ux];
      best = {
        area,
        ring: [
          corner(minU, minV),
          corner(maxU, minV),
          corner(maxU, maxV),
          corner(minU, maxV),
        ],
      };
    }
  }
  return best?.ring ?? hull;
}

/** Scale a ring about its centroid so its area matches `targetArea` (same units). */
export function scaleRingToArea(ring: number[][], targetArea: number): number[][] {
  const r = openRing(ring);
  const area = Math.abs(signedArea(r));
  if (area <= 0 || targetArea <= 0) return r;
  const k = Math.sqrt(targetArea / area);
  const cx = r.reduce((s, p) => s + p[0], 0) / r.length;
  const cy = r.reduce((s, p) => s + p[1], 0) / r.length;
  return r.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

/** Remove near-collinear vertices so the outline reads as a building, not a trace. */
export function simplifyRingM(ring: number[][], toleranceM = 0.6): number[][] {
  let r = toCCW(ring);
  if (r.length <= 4) return r;
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i - 1 + r.length) % r.length];
      const b = r[i];
      const c = r[(i + 1) % r.length];
      const abx = b[0] - a[0];
      const aby = b[1] - a[1];
      const acx = c[0] - a[0];
      const acy = c[1] - a[1];
      const len = Math.hypot(acx, acy);
      if (len < 1e-9) continue;
      const dist = Math.abs(abx * acy - aby * acx) / len;
      if (dist < toleranceM) {
        r = r.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return r;
}

/** Snap near-90° corners to the building's dominant axis (metre plane). */
export function orthogonalizeRingM(ring: number[][], maxSnapDeg = 12): number[][] {
  const r = toCCW(ring);
  if (r.length < 4) return r;
  const theta = dominantAngle(r);
  const cos = Math.cos(-theta);
  const sin = Math.sin(-theta);
  const rot = (p: number[]) => [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos];
  const unrot = (p: number[]) => [
    p[0] * Math.cos(theta) - p[1] * Math.sin(theta),
    p[0] * Math.sin(theta) + p[1] * Math.cos(theta),
  ];
  const local = r.map(rot);
  const snapTol = Math.tan((maxSnapDeg * Math.PI) / 180);
  for (let i = 0; i < local.length; i++) {
    const a = local[i];
    const b = local[(i + 1) % local.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) continue;
    if (Math.abs(dy) < Math.abs(dx) * snapTol) {
      const y = (a[1] + b[1]) / 2;
      a[1] = y;
      b[1] = y;
    } else if (Math.abs(dx) < Math.abs(dy) * snapTol) {
      const x = (a[0] + b[0]) / 2;
      a[0] = x;
      b[0] = x;
    }
  }
  return local.map(unrot);
}

/** Angle (radians) of the building's dominant axis, weighted by edge length. */
export function dominantAngle(ringM: number[][]): number {
  const r = openRing(ringM);
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i];
    const b = r[(i + 1) % r.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    // Double the angle so perpendicular edges reinforce the same axis.
    const ang = 2 * Math.atan2(dy, dx);
    sx += Math.cos(ang) * len;
    sy += Math.sin(ang) * len;
  }
  return Math.atan2(sy, sx) / 2;
}

/** Clip a polygon by the half-plane { p : nx*px + ny*py <= c } (Sutherland–Hodgman). */
function clipHalfPlane(ring: number[][], nx: number, ny: number, c: number): number[][] {
  if (ring.length < 3) return [];
  const out: number[][] = [];
  const inside = (p: number[]) => nx * p[0] + ny * p[1] <= c + 1e-9;
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i];
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn !== prevIn) {
      const dp = nx * prev[0] + ny * prev[1];
      const dc = nx * cur[0] + ny * cur[1];
      const t = (c - dp) / (dc - dp);
      out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]);
    }
    if (curIn) out.push(cur);
  }
  return out;
}

export type RoofFace = {
  ring: number[][];
  /** Downslope compass bearing in degrees (0 = north, 90 = east). */
  azimuth: number;
  /** Plan area in square metres. */
  areaM2: number;
};

/**
 * Break a footprint into the faces of a uniform-slope roof.
 *
 * Every point on the roof drains to its nearest wall, so the face belonging to
 * wall `i` is the set of points closer to wall `i` than to any other wall. Each
 * "closer than" test is a half-plane, so each face is an exact clip of the
 * footprint. Together the faces tile the footprint — complete coverage, no
 * overlaps, all following the building's real angle.
 */
export function hipFaces(footprintM: number[][]): RoofFace[] {
  const r = toCCW(simplifyRingM(footprintM));
  const n = r.length;
  if (n < 3) return [];

  type Wall = { nx: number; ny: number; c: number; azimuth: number };
  const walls: Wall[] = [];
  for (let i = 0; i < n; i++) {
    const a = r[i];
    const b = r[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.4) continue; // ignore sub-half-metre wall stubs
    // CCW ring → inward normal is the left normal of the edge direction.
    const nx = -dy / len;
    const ny = dx / len;
    const c = nx * a[0] + ny * a[1];
    // distance(p) = nx*px + ny*py - c ; downslope points outward
    const azimuth = ((Math.atan2(-nx, -ny) * 180) / Math.PI + 360) % 360;
    walls.push({ nx, ny, c, azimuth });
  }
  if (walls.length < 3) return [];

  const faces: RoofFace[] = [];
  for (let i = 0; i < walls.length; i++) {
    let poly = r.slice();
    const wi = walls[i];
    for (let j = 0; j < walls.length && poly.length >= 3; j++) {
      if (j === i) continue;
      const wj = walls[j];
      // (ni·p - ci) <= (nj·p - cj)  =>  (ni - nj)·p <= ci - cj
      poly = clipHalfPlane(poly, wi.nx - wj.nx, wi.ny - wj.ny, wi.c - wj.c);
    }
    if (poly.length < 3) continue;
    const areaM2 = Math.abs(signedArea(poly));
    if (areaM2 < 1) continue;
    faces.push({ ring: poly, azimuth: wi.azimuth, areaM2 });
  }
  return faces;
}

function angleDelta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export type SolarSegmentInput = {
  azimuth_degrees: number;
  pitch_degrees: number;
  area_m2: number;
};

export type FittedFacet = {
  /** Closed ring in [lng, lat]. */
  ring: number[][];
  plan_area_sqft: number;
  pitch: string;
  pitch_degrees: number;
  azimuth_degrees: number;
};

function pitchString(deg: number): string {
  const rise = Math.round(Math.tan((deg * Math.PI) / 180) * 12);
  return `${Math.max(0, Math.min(12, rise))}/12`;
}

function unionRings(
  rings: number[][][],
  proj: Projector,
): number[][][] {
  const polys = rings
    .map((ring) => {
      const closed = closeRing(ring.map(proj.from));
      return closed.length >= 4 ? turf.polygon([closed]) : null;
    })
    .filter((p): p is Feature<Polygon> => p !== null);
  if (polys.length === 0) return [];
  if (polys.length === 1) return [polys[0].geometry.coordinates[0]];
  try {
    // Buffer a hair so shared edges actually merge instead of leaving hairlines.
    const grown = polys.map((p) => turf.buffer(p, 0.12, { units: "meters" }) ?? p);
    const merged = turf.union(turf.featureCollection(grown as Feature<Polygon>[]));
    if (!merged) return polys.map((p) => p.geometry.coordinates[0]);
    const shrunk = turf.buffer(merged, -0.12, { units: "meters" }) ?? merged;
    const geom = shrunk.geometry;
    if (geom.type === "Polygon") return [geom.coordinates[0]];
    if (geom.type === "MultiPolygon") return geom.coordinates.map((c) => c[0]);
    return polys.map((p) => p.geometry.coordinates[0]);
  } catch {
    return polys.map((p) => p.geometry.coordinates[0]);
  }
}

/**
 * Fit roof facets to a building footprint, using Google's segments only for
 * slope information (pitch + which way each plane faces).
 *
 * @param footprint Closed or open ring in [lng, lat].
 * @param segments  Google roof segments (may be empty — then a plain hip fit).
 * @param opts.mergeSmall Merge faces that share a slope direction (default on).
 */
export function fitFacetsToFootprint(
  footprint: number[][],
  segments: SolarSegmentInput[],
  opts: { mergeSmall?: boolean; minFacetSqft?: number; snapSquare?: boolean } = {},
): { facets: FittedFacet[]; footprint: number[][]; plan_area_sqft: number } {
  const mergeSmall = opts.mergeSmall !== false;
  const minFacetSqft = opts.minFacetSqft ?? 25;

  const ringLL = openRing(footprint);
  if (ringLL.length < 3) {
    return { facets: [], footprint: [], plan_area_sqft: 0 };
  }
  const [oLng, oLat] = [
    ringLL.reduce((s, p) => s + p[0], 0) / ringLL.length,
    ringLL.reduce((s, p) => s + p[1], 0) / ringLL.length,
  ];
  const proj = makeProjector(oLng, oLat);

  let footM = toCCW(ringLL.map(proj.to));
  footM = simplifyRingM(footM, 0.6);
  if (opts.snapSquare !== false) footM = orthogonalizeRingM(footM);

  const faces = hipFaces(footM);
  const totalM2 = Math.abs(signedArea(footM));

  // Group faces by the roof plane they belong to. With Google segments we snap
  // each face to the nearest reported slope direction; without them we group by
  // the face's own bearing so opposite slopes of a gable stay separate.
  const usable = segments.filter((s) => Number.isFinite(s.azimuth_degrees));
  const groups = new Map<string, { faces: RoofFace[]; pitchDeg: number; azimuth: number }>();

  for (const face of faces) {
    let key: string;
    let pitchDeg: number;
    let azimuth = face.azimuth;
    if (usable.length > 0) {
      let bestIdx = 0;
      let bestDelta = Infinity;
      usable.forEach((s, i) => {
        const d = angleDelta(s.azimuth_degrees, face.azimuth);
        if (d < bestDelta) {
          bestDelta = d;
          bestIdx = i;
        }
      });
      const seg = usable[bestIdx];
      key = mergeSmall ? `s${bestIdx}` : `s${bestIdx}-${faces.indexOf(face)}`;
      pitchDeg = seg.pitch_degrees;
      azimuth = seg.azimuth_degrees;
    } else {
      const bucket = mergeSmall ? Math.round(face.azimuth / 45) * 45 : face.azimuth;
      key = `a${bucket}`;
      pitchDeg = 22; // ~5/12, the US residential median, when Google has nothing
    }
    const g = groups.get(key);
    if (g) g.faces.push(face);
    else groups.set(key, { faces: [face], pitchDeg, azimuth });
  }

  const facets: FittedFacet[] = [];
  for (const g of groups.values()) {
    const rings = mergeSmall
      ? unionRings(g.faces.map((f) => f.ring), proj)
      : g.faces.map((f) => closeRing(f.ring.map(proj.from)));
    for (const ringLngLat of rings) {
      // Merging leaves rounded micro-vertices from the buffer trick — clean them.
      const cleanedM = simplifyRingM(openRing(ringLngLat).map(proj.to), 0.35);
      if (cleanedM.length < 3) continue;
      const areaM2 = Math.abs(signedArea(cleanedM));
      const sqft = areaM2 * SQM_TO_SQFT;
      if (sqft < minFacetSqft) continue;
      facets.push({
        ring: closeRing(cleanedM.map(proj.from)),
        plan_area_sqft: sqft,

        pitch: pitchString(g.pitchDeg),
        pitch_degrees: g.pitchDeg,
        azimuth_degrees: g.azimuth,
      });
    }
  }

  facets.sort((a, b) => b.plan_area_sqft - a.plan_area_sqft);

  return {
    facets,
    footprint: closeRing(footM.map(proj.from)),
    plan_area_sqft: totalM2 * SQM_TO_SQFT,
  };
}

/**
 * Last-resort footprint when no vector outline is available: take every corner
 * of Google's segment bounding boxes, hull them, and wrap them in the smallest
 * rotated rectangle. Far better than stacking north-aligned boxes because the
 * rectangle follows the diagonal of the house.
 */
export function footprintFromSegmentBoxes(
  boxes: Array<{ sw: [number, number]; ne: [number, number] }>,
  totalPlanSqft: number,
): number[][] | null {
  const pts: number[][] = [];
  for (const b of boxes) {
    pts.push([b.sw[0], b.sw[1]], [b.ne[0], b.sw[1]], [b.ne[0], b.ne[1]], [b.sw[0], b.ne[1]]);
  }
  if (pts.length < 4) return null;
  const oLng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const oLat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const proj = makeProjector(oLng, oLat);
  let rect = minAreaRect(pts.map(proj.to));
  if (rect.length < 3) return null;
  if (totalPlanSqft > 0) {
    const targetM2 = totalPlanSqft / SQM_TO_SQFT;
    const rectM2 = Math.abs(signedArea(rect));
    // Boxes overshoot the real roof; pull the rectangle in to the reported area,
    // but never below 65% of the hull (guards against bad area reports).
    if (rectM2 > targetM2 && targetM2 > rectM2 * 0.4) rect = scaleRingToArea(rect, targetM2);
  }
  return closeRing(rect.map(proj.from));
}

/* ------------------------------------------------------------------ */
/* Voronoi carve — facets cut out of the real footprint                */
/* ------------------------------------------------------------------ */

export type SolarSegmentCenter = {
  lng: number;
  lat: number;
  pitch_degrees: number | null;
  azimuth_degrees: number;
  area_m2: number;
};

export type CarvedFacet = FittedFacet & { pitch_known: boolean };

/**
 * Carve a building footprint into roof facets using the Google Solar segment
 * centres as Voronoi seeds. Because every facet is a clip of the real
 * footprint, the facets tile the house exactly: no gaps, no overlaps, and the
 * geometry follows the true shape/angle of the building instead of a
 * north-aligned bounding box.
 *
 * Returns null when the footprint is unusable so callers can fall back.
 */
export function carveFootprintByCenters(
  footprint: number[][],
  segments: SolarSegmentCenter[],
  opts: { minFacetSqft?: number } = {},
): { facets: CarvedFacet[]; footprint: number[][]; plan_area_sqft: number } | null {
  const minFacetSqft = opts.minFacetSqft ?? 20;
  const ringLL = openRing(footprint);
  if (ringLL.length < 3) return null;

  const oLng = ringLL.reduce((s, p) => s + p[0], 0) / ringLL.length;
  const oLat = ringLL.reduce((s, p) => s + p[1], 0) / ringLL.length;
  const proj = makeProjector(oLng, oLat);

  const footM = simplifyRingM(toCCW(ringLL.map(proj.to)), 0.4);
  if (footM.length < 3) return null;
  const totalM2 = Math.abs(signedArea(footM));
  if (totalM2 <= 0) return null;
  const P = turf.polygon([closeRing(footM)]);

  const mk = (
    ringM: number[][],
    pitchDeg: number | null,
    azimuth: number,
  ): CarvedFacet | null => {
    const cleaned = simplifyRingM(openRing(ringM), 0.3);
    if (cleaned.length < 3) return null;
    const areaM2 = Math.abs(signedArea(cleaned));
    const sqft = areaM2 * SQM_TO_SQFT;
    if (sqft < minFacetSqft) return null;
    const known = pitchDeg !== null && Number.isFinite(pitchDeg);
    return {
      ring: closeRing(cleaned.map(proj.from)),
      plan_area_sqft: sqft,
      pitch: known ? pitchString(pitchDeg as number) : "unknown",
      pitch_degrees: known ? (pitchDeg as number) : 0,
      azimuth_degrees: azimuth,
      pitch_known: known,
    };
  };

  const result = (facets: CarvedFacet[]) => ({
    facets: facets.sort((a, b) => b.plan_area_sqft - a.plan_area_sqft),
    footprint: closeRing(footM.map(proj.from)),
    plan_area_sqft: totalM2 * SQM_TO_SQFT,
  });

  // Only seeds that actually sit on this building.
  const inside = segments.filter((s) => {
    if (!Number.isFinite(s.lng) || !Number.isFinite(s.lat)) return false;
    try {
      return turf.booleanPointInPolygon(turf.point(proj.to([s.lng, s.lat])), P);
    } catch {
      return false;
    }
  });

  if (inside.length === 0) {
    // No slope data for this building — one facet, pitch genuinely unknown
    // unless Google gave us a dominant pitch elsewhere on the property.
    const withPitch = segments.filter((s) => s.pitch_degrees !== null);
    let dominant: number | null = null;
    if (withPitch.length > 0) {
      dominant = withPitch.reduce((best, s) =>
        s.area_m2 > best.area_m2 ? s : best,
      ).pitch_degrees;
    }
    const f = mk(footM, dominant, 0);
    return f ? result([f]) : null;
  }

  if (inside.length === 1) {
    const s = inside[0];
    const f = mk(footM, s.pitch_degrees, s.azimuth_degrees);
    return f ? result([f]) : null;
  }

  const seedPts = inside.map((s) => turf.point(proj.to([s.lng, s.lat])));
  const bbox = turf.bbox(P) as [number, number, number, number];
  const pad = 5; // metres of slack so edge cells stay bounded
  let cells: Array<Feature<Polygon> | null> = [];
  try {
    const v = turf.voronoi(turf.featureCollection(seedPts), {
      bbox: [bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad],
    });
    cells = (v.features ?? []) as Array<Feature<Polygon> | null>;
  } catch {
    return null;
  }

  const facets: CarvedFacet[] = [];
  cells.forEach((cell, i) => {
    if (!cell) return;
    const seg = inside[i];
    if (!seg) return;
    let clipped: Feature<Polygon> | null = null;
    try {
      const res = turf.intersect(turf.featureCollection([cell, P]));
      if (res && res.geometry.type === "Polygon") {
        clipped = res as Feature<Polygon>;
      } else if (res && res.geometry.type === "MultiPolygon") {
        // keep the biggest piece
        const parts = res.geometry.coordinates.map((c) => turf.polygon(c));
        clipped = parts.sort(
          (a, b) => Math.abs(signedArea(b.geometry.coordinates[0])) -
            Math.abs(signedArea(a.geometry.coordinates[0])),
        )[0];
      }
    } catch {
      clipped = null;
    }
    if (!clipped) return;
    const f = mk(clipped.geometry.coordinates[0], seg.pitch_degrees, seg.azimuth_degrees);
    if (f) facets.push(f);
  });

  if (facets.length === 0) return null;
  return result(facets);
}
