import { supabase } from "@/integrations/supabase/client";
import {
  EDGE_COLORS,
  EDGE_LABELS,
  EDGE_TYPES,
  haversineFeet,
  lineStringLengthFeet,
  pitchMultiplier,
  polygonAreaSqft,
  polygonEdgeLengths,
  PITCH_OPTIONS,
  type EdgeType,
} from "@/lib/roof-math";

export { EDGE_COLORS, EDGE_LABELS, EDGE_TYPES, PITCH_OPTIONS };
export type { EdgeType };

/** Claim Buddy adds an explicit "not labelled yet" state on every edge. */
export type CbEdgeType = EdgeType | "unlabeled";

/** Order shown in the label sheet — unlabeled last, as a way to clear a label. */
export const CB_EDGE_TYPES: CbEdgeType[] = [...EDGE_TYPES, "unlabeled"];

export const CB_EDGE_LABELS: Record<CbEdgeType, string> = {
  ...EDGE_LABELS,
  unlabeled: "Unlabeled",
};

export const CB_EDGE_COLORS: Record<CbEdgeType, string> = {
  ...EDGE_COLORS,
  unlabeled: "#e2e8f0",
};

/** One structure on the plan. `ring` is an OPEN ring of [lng,lat] pairs. */
export interface CbPlanSection {
  id: string;
  name: string;
  color: string;
  ring: number[][];
  pitch: string;
  edges: CbEdgeType[];
  structureKey: string;
  pin: { lat: number; lng: number } | null;
  isLocked: boolean;
  aiRing: number[][] | null;
}

export interface CbPlanLine {
  id: string;
  coords: number[][];
  type: CbEdgeType;
}

export interface CbPlan {
  sections: CbPlanSection[];
  lines: CbPlanLine[];
}


export interface CbPlanTotals {
  total_area_sqft: number;
  total_squares: number;
  facets: number;
  pitch: string | null;
  ridge_lf: number;
  hip_lf: number;
  valley_lf: number;
  rake_lf: number;
  eave_lf: number;
  gutter_lf: number;
  wall_flashing_lf: number;
  step_flashing_lf: number;
  /** Full traced outline length — the roof perimeter, labels or not. */
  perimeter_lf: number;
}


export const CB_SECTION_COLORS = [
  "#f97316",
  "#22d3ee",
  "#a78bfa",
  "#facc15",
  "#34d399",
  "#fb7185",
];

export const CB_EMPTY_PLAN: CbPlan = { sections: [], lines: [] };

export function cbSectionColor(i: number): string {
  return CB_SECTION_COLORS[i % CB_SECTION_COLORS.length];
}

/* ------------------------------ geometry ------------------------------ */

/** Feet-per-degree scale around a latitude. */
export function ftPerDeg(lat: number) {
  const ftLat = 364320;
  return { lat: ftLat, lng: ftLat * Math.cos((lat * Math.PI) / 180) };
}

/** Open a ring (drop the duplicated closing point). */
export function openRing(ring: number[][]): number[][] {
  if (ring.length > 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring;
}

export function closeRing(ring: number[][]): number[][] {
  if (!ring.length) return ring;
  return [...ring, ring[0]];
}

export function sectionPlanAreaSqft(s: CbPlanSection): number {
  return polygonAreaSqft(closeRing(s.ring));
}

export function sectionActualAreaSqft(s: CbPlanSection): number {
  return sectionPlanAreaSqft(s) * pitchMultiplier(s.pitch);
}

export function sectionEdgeLengths(s: CbPlanSection): number[] {
  return polygonEdgeLengths(closeRing(s.ring));
}

export function edgeCenter(ring: number[][], i: number): [number, number] {
  const a = ring[i];
  const b = ring[(i + 1) % ring.length];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export function ringCentroid(ring: number[][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

/** Bearing of an edge in degrees, normalised into 0–180. */
function edgeAzimuth(a: number[], b: number[]): number {
  const s = ftPerDeg((a[1] + b[1]) / 2);
  const dx = (b[0] - a[0]) * s.lng;
  const dy = (b[1] - a[1]) * s.lat;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 180;
  if (deg >= 180) deg -= 180;
  return deg;
}

/**
 * Auto-classify perimeter edges: the dominant run of the roof is the low side
 * (eave), edges running up the slope are rakes.
 */
export function autoClassifyEdges(ring: number[][]): EdgeType[] {
  const n = ring.length;
  if (n < 3) return [];
  const lens = polygonEdgeLengths(closeRing(ring));
  let dominant = 0;
  let best = -1;
  for (let i = 0; i < n; i++) {
    if (lens[i] > best) {
      best = lens[i];
      dominant = edgeAzimuth(ring[i], ring[(i + 1) % n]);
    }
  }
  return ring.map((_, i) => {
    const az = edgeAzimuth(ring[i], ring[(i + 1) % n]);
    let d = Math.abs(az - dominant);
    if (d > 90) d = 180 - d;
    return d <= 30 ? ("eave" as EdgeType) : ("rake" as EdgeType);
  });
}

/**
 * Keep the edge-type array the same length as the ring after an edit.
 * Claim Buddy never guesses: an untouched edge stays "unlabeled" until the
 * rep taps it and picks a type.
 */
export function normalizeEdges(ring: number[][], edges: CbEdgeType[]): CbEdgeType[] {
  return ring.map((_, i) => edges[i] ?? "unlabeled");
}

/**
 * Merge every traced facet into ONE roof footprint outline.
 * Reps want one shape to drag onto the real roof edges, then draw the ridges
 * and hips as lines themselves.
 */
export async function mergeSectionsToFootprint(plan: CbPlan): Promise<CbPlan> {
  if (plan.sections.length < 2) return plan;
  const first = plan.sections[0];
  let ring: number[][] | null = null;

  try {
    const [{ union }, { polygon, featureCollection }] = await Promise.all([
      import("@turf/union"),
      import("@turf/helpers"),
    ]);
    const polys = plan.sections
      .filter((s) => s.ring.length >= 3)
      .map((s) => polygon([closeRing(s.ring)]));
    if (polys.length) {
      const merged = union(featureCollection(polys) as never);
      const g = merged?.geometry;
      if (g?.type === "Polygon") ring = openRing(g.coordinates[0] as number[][]);
      else if (g?.type === "MultiPolygon") {
        // Disjoint structures — keep the biggest outline as the main roof.
        const rings = (g.coordinates as number[][][][]).map((c) => openRing(c[0]));
        ring = rings.sort((a, b) => polygonAreaSqft(closeRing(b)) - polygonAreaSqft(closeRing(a)))[0];
      }
    }
  } catch {
    ring = null;
  }

  if (!ring || ring.length < 3) {
    // Fall back to the largest single facet rather than losing the trace.
    ring = plan.sections
      .slice()
      .sort((a, b) => sectionPlanAreaSqft(b) - sectionPlanAreaSqft(a))[0].ring;
  }

  const pitch =
    plan.sections
      .slice()
      .sort((a, b) => sectionPlanAreaSqft(b) - sectionPlanAreaSqft(a))[0]?.pitch ?? first.pitch;

  return {
    ...plan,
    sections: [
      {
        id: first.id,
        name: "Roof footprint",
        color: first.color || cbSectionColor(0),
        ring,
        pitch,
        edges: ring.map(() => "unlabeled" as CbEdgeType),
        structureKey: first.structureKey,
        pin: first.pin,
        isLocked: first.isLocked,
        aiRing: first.aiRing,
      },
    ],
  };
}

/** Name shown for structure N — reps think "main roof", "flat roof", "shed". */
function structureName(i: number): string {
  return i === 0 ? "Main roof" : i === 1 ? "Flat roof" : `Structure ${i + 1}`;
}

/**
 * ONE highlighted outline per dropped pin.
 *
 * Every facet the tracer returns is assigned to the pin it sits closest to,
 * then each pin's facets are unioned into a single outline with its own
 * overlay colour. Without pins, facets that touch each other are clustered
 * together so old multi-facet plans also collapse to one shape per building.
 */
export async function mergeSectionsByStructure(
  plan: CbPlan,
  pins: Array<{ lat: number; lng: number }> = [],
): Promise<CbPlan> {
  if (plan.sections.length < 2) {
    if (!plan.sections.length) return plan;
    const only = plan.sections[0];
    return {
      ...plan,
      sections: [{ ...only, name: only.name || structureName(0), color: cbSectionColor(0) }],
    };
  }

  const groups: CbPlanSection[][] = [];

  const keyed = new Map<string, CbPlanSection[]>();
  for (const section of plan.sections) {
    if (!section.structureKey) continue;
    keyed.set(section.structureKey, [...(keyed.get(section.structureKey) ?? []), section]);
  }
  if (keyed.size && [...keyed.values()].flat().length === plan.sections.length) {
    groups.push(...keyed.values());
  }

  if (!groups.length && pins.length > 1) {
    pins.forEach(() => groups.push([]));
    for (const section of plan.sections) {
      const [cx, cy] = ringCentroid(section.ring);
      let nearest = 0;
      let best = Infinity;
      pins.forEach((pin, i) => {
        const s = ftPerDeg(pin.lat);
        const d = Math.hypot((cx - pin.lng) * s.lng, (cy - pin.lat) * s.lat);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      groups[nearest].push(section);
    }
  } else if (!groups.length && pins.length === 1) {
    groups.push([...plan.sections]);
  } else if (!groups.length) {
    // No pins to group by: cluster facets that overlap or touch.
    let intersects: ((a: unknown, b: unknown) => boolean) | null = null;
    let polygonOf: ((ring: number[][]) => unknown) | null = null;
    try {
      const [{ default: booleanIntersects }, { polygon }] = await Promise.all([
        import("@turf/boolean-intersects"),
        import("@turf/helpers"),
      ]);
      intersects = booleanIntersects as unknown as (a: unknown, b: unknown) => boolean;
      polygonOf = (ring: number[][]) => polygon([closeRing(ring)]);
    } catch {
      intersects = null;
    }
    for (const section of plan.sections) {
      let placed = false;
      if (intersects && polygonOf) {
        for (const group of groups) {
          if (
            group.some((other) => {
              try {
                return intersects!(polygonOf!(other.ring), polygonOf!(section.ring));
              } catch {
                return false;
              }
            })
          ) {
            group.push(section);
            placed = true;
            break;
          }
        }
      }
      if (!placed) groups.push([section]);
    }
  }

  const merged: CbPlanSection[] = [];
  for (const group of groups) {
    if (!group.length) continue;
    const one = await mergeSectionsToFootprint({ sections: group, lines: [] });
    const section = one.sections[0];
    if (!section) continue;
    const i = merged.length;
    merged.push({
      ...section,
      name: structureName(i),
      color: cbSectionColor(i),
      structureKey: group[0]?.structureKey || `structure-${i + 1}`,
      pin: group[0]?.pin ?? (pins[i] ?? null),
      isLocked: group.every((item) => item.isLocked),
      aiRing: group[0]?.aiRing ?? section.ring.map((point) => [...point]),
    });
  }

  if (!merged.length) return plan;
  return { ...plan, sections: merged };
}




/**
 * Snap a dragged vertex so the two edges touching it land on 15° increments
 * when they are already close to one.
 */
export function snapVertex(
  ring: number[][],
  index: number,
  point: [number, number],
  toleranceDeg = 5,
): [number, number] {
  const n = ring.length;
  if (n < 3) return point;
  const anchors = [ring[(index - 1 + n) % n], ring[(index + 1) % n]];
  let out: [number, number] = point;
  for (const anchor of anchors) {
    const s = ftPerDeg(anchor[1]);
    const dx = (out[0] - anchor[0]) * s.lng;
    const dy = (out[1] - anchor[1]) * s.lat;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const snapped = Math.round(deg / 15) * 15;
    if (Math.abs(deg - snapped) > toleranceDeg) continue;
    const rad = (snapped * Math.PI) / 180;
    out = [
      anchor[0] + (Math.cos(rad) * len) / s.lng,
      anchor[1] + (Math.sin(rad) * len) / s.lat,
    ];
    break;
  }
  return out;
}

/** A square structure of `sizeFt` centred on a point. */
export function squareRing(center: [number, number], sizeFt = 32): number[][] {
  const s = ftPerDeg(center[1]);
  const dx = sizeFt / 2 / s.lng;
  const dy = sizeFt / 2 / s.lat;
  return [
    [center[0] - dx, center[1] - dy],
    [center[0] + dx, center[1] - dy],
    [center[0] + dx, center[1] + dy],
    [center[0] - dx, center[1] + dy],
  ];
}

export function lineLengthFeet(coords: number[][]): number {
  return lineStringLengthFeet(coords);
}

export function pointDistanceFeet(a: number[], b: number[]): number {
  return haversineFeet({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
}

/** Project a point onto the nearest roof-outline segment. */
export function nearestPointOnRing(ring: number[][], point: [number, number]): [number, number] {
  if (ring.length < 2) return point;
  const scale = ftPerDeg(point[1]);
  let best: [number, number] = point;
  let bestDistance = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ax = (a[0] - point[0]) * scale.lng;
    const ay = (a[1] - point[1]) * scale.lat;
    const bx = (b[0] - point[0]) * scale.lng;
    const by = (b[1] - point[1]) * scale.lat;
    const vx = bx - ax;
    const vy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / (vx * vx + vy * vy || 1)));
    const x = ax + t * vx;
    const y = ay + t * vy;
    const distance = Math.hypot(x, y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = [point[0] + x / scale.lng, point[1] + y / scale.lat];
    }
  }
  return best;
}

/* ------------------------------- totals ------------------------------- */

export function planTotals(plan: CbPlan): CbPlanTotals {
  const byType: Record<string, number> = {};
  for (const t of EDGE_TYPES) byType[t] = 0;

  let area = 0;
  let perimeter = 0;
  const pitchArea: Record<string, number> = {};

  for (const s of plan.sections) {
    const plan_area = sectionPlanAreaSqft(s);
    const actual = plan_area * pitchMultiplier(s.pitch);
    area += actual;
    pitchArea[s.pitch] = (pitchArea[s.pitch] ?? 0) + actual;
    const lens = sectionEdgeLengths(s);
    const edges = normalizeEdges(s.ring, s.edges);
    edges.forEach((t, i) => {
      byType[t] = (byType[t] ?? 0) + (lens[i] ?? 0);
      perimeter += lens[i] ?? 0;
    });
  }

  for (const l of plan.lines) {
    byType[l.type] = (byType[l.type] ?? 0) + lineLengthFeet(l.coords);
  }

  const predominant =
    Object.entries(pitchArea).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const r = (n: number) => Math.round(n * 10) / 10;

  return {
    total_area_sqft: Math.round(area),
    total_squares: Math.round((area / 100) * 100) / 100,
    facets: plan.sections.length,
    pitch: predominant,
    ridge_lf: r(byType.ridge),
    hip_lf: r(byType.hip),
    valley_lf: r(byType.valley),
    rake_lf: r(byType.rake),
    eave_lf: r(byType.eave),
    gutter_lf: r(byType.gutter || byType.eave),
    wall_flashing_lf: r(byType.wall_flashing),
    step_flashing_lf: r(byType.step_flashing),
    perimeter_lf: r(perimeter),
  };

}

/* ----------------------------- persistence ---------------------------- */

type RawSection = {
  id: string;
  name: string;
  color: string;
  polygon_geojson: unknown;
  pitch: string;
  edges: { edge_index: number; edge_type: EdgeType; length_lf: number }[];
  structure_key?: string | null;
  pin_lat?: number | null;
  pin_lng?: number | null;
  is_locked?: boolean | null;
  ai_polygon_geojson?: unknown;
};

function ringFromGeoJson(g: unknown): number[][] {
  const o = g as { type?: string; coordinates?: unknown; geometry?: unknown } | null;
  if (!o) return [];
  if (o.geometry) return ringFromGeoJson(o.geometry);
  const c = o.coordinates as number[][][] | number[][] | undefined;
  if (!c) return [];
  const ring = Array.isArray((c as number[][][])[0]?.[0])
    ? ((c as number[][][])[0] as number[][])
    : (c as number[][]);
  return openRing(ring.filter((p) => Array.isArray(p) && p.length >= 2));
}

/** Make sure the Claim Buddy job has a roof_measurements row to hang the plan off. */
export async function ensureCbRoofMeasurement(jobId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("cb_ensure_roof_measurement", { _job: jobId });
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function loadCbRoofPlan(jobId: string): Promise<CbPlan> {
  await ensureCbRoofMeasurement(jobId);
  const { data, error } = await supabase.rpc("cb_roof_plan", { _job: jobId });
  if (error || !data) return { sections: [], lines: [] };
  const payload = data as { sections?: RawSection[]; lines?: unknown[] };

  const sections: CbPlanSection[] = (payload.sections ?? []).map((s, i) => {
    const ring = ringFromGeoJson(s.polygon_geojson);
    const edges = (s.edges ?? [])
      .slice()
      .sort((a, b) => a.edge_index - b.edge_index)
      .map((e) => e.edge_type);
    return {
      id: s.id,
      name: s.name || `Structure ${i + 1}`,
      color: s.color || cbSectionColor(i),
      ring,
      pitch: s.pitch || "6/12",
      edges: normalizeEdges(ring, edges),
      structureKey: s.structure_key || `structure-${i + 1}`,
      pin:
        s.pin_lat != null && s.pin_lng != null
          ? { lat: Number(s.pin_lat), lng: Number(s.pin_lng) }
          : null,
      isLocked: !!s.is_locked,
      aiRing: s.ai_polygon_geojson ? ringFromGeoJson(s.ai_polygon_geojson) : ring.map((p) => [...p]),
    };
  });

  const lines: CbPlanLine[] = (payload.lines ?? []).map((raw) => {
    const l = raw as { id: string; line_geojson: unknown; line_type: EdgeType };
    const g = l.line_geojson as { coordinates?: number[][]; geometry?: { coordinates?: number[][] } };
    const coords = (g?.coordinates ?? g?.geometry?.coordinates ?? []) as number[][];
    return { id: l.id, coords, type: l.line_type };
  });

  return { sections: sections.filter((s) => s.ring.length >= 3), lines };
}

export async function saveCbRoofPlan(
  jobId: string,
  plan: CbPlan,
  opts: { repAdjusted: boolean },
): Promise<CbPlanTotals> {
  const totals = planTotals(plan);
  const sections = plan.sections.map((s, i) => {
    const planArea = sectionPlanAreaSqft(s);
    const mult = pitchMultiplier(s.pitch);
    const lens = sectionEdgeLengths(s);
    const edges = normalizeEdges(s.ring, s.edges);
    return {
      name: s.name,
      color: s.color,
      polygon_geojson: { type: "Polygon", coordinates: [closeRing(s.ring)] },
      plan_area_sqft: Math.round(planArea),
      pitch: s.pitch,
      pitch_multiplier: Math.round(mult * 1000) / 1000,
      actual_area_sqft: Math.round(planArea * mult),
      sort_order: i,
      structure_key: s.structureKey,
      pin_lat: s.pin?.lat ?? null,
      pin_lng: s.pin?.lng ?? null,
      is_locked: s.isLocked,
      ai_polygon_geojson: s.aiRing?.length
        ? { type: "Polygon", coordinates: [closeRing(s.aiRing)] }
        : null,
      edges: edges.map((t, idx) => ({
        edge_index: idx,
        edge_type: t,
        length_lf: Math.round((lens[idx] ?? 0) * 10) / 10,
      })),
    };
  });

  const lines = plan.lines.map((l) => ({
    line_geojson: { type: "LineString", coordinates: l.coords },
    line_type: l.type,
    length_lf: Math.round(lineLengthFeet(l.coords) * 10) / 10,
  }));

  const { error } = await supabase.rpc("cb_save_roof_plan", {
    _job: jobId,
    _sections: sections as never,
    _lines: lines as never,
    _totals: {
      ...totals,
      rep_adjusted: opts.repAdjusted,
      source: opts.repAdjusted ? "manual" : undefined,
    } as never,
  });
  if (error) throw error;
  return totals;
}
