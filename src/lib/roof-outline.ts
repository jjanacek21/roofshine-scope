/**
 * Roof outline invariants — see docs/MEASUREMENT_INVARIANTS.md.
 *
 * The AI traces ONE closed outline per structure and nothing else. No facet
 * decomposition, no triangulation, no axis-aligned placeholder rectangle. These
 * pure helpers are used both by the server measurement path (to reject a bad
 * shape at runtime) and by the regression test.
 */

export type OutlineProblem =
  | "too_few_points"
  | "duplicate_vertex"
  | "self_intersecting"
  | "axis_aligned_rectangle";

export type OutlineCheck = { ok: boolean; problems: OutlineProblem[] };

/** Drop a trailing point equal to the first so rings compare consistently. */
export function openOutline(ring: number[][]): number[][] {
  if (ring.length < 2) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? ring.slice(0, -1) : ring;
}

/** Two points within ~2 cm of each other are the same corner. */
const DUP_EPS = 2e-7;

function hasDuplicateVertex(ring: number[][]): boolean {
  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 1; j < ring.length; j++) {
      if (
        Math.abs(ring[i][0] - ring[j][0]) < DUP_EPS &&
        Math.abs(ring[i][1] - ring[j][1]) < DUP_EPS
      ) {
        return true;
      }
    }
  }
  return false;
}

function segmentsCross(p1: number[], p2: number[], p3: number[], p4: number[]): boolean {
  const d = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

export function isSelfIntersecting(ring: number[][]): boolean {
  const r = openOutline(ring);
  const n = r.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges (they legitimately share a corner).
      if (i === j || (i + 1) % n === j || (j + 1) % n === i) continue;
      if (segmentsCross(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * A four-corner shape whose edges all run exactly north-south / east-west is a
 * bounding box, not a traced roof. It is the classic "square roof" fallback and
 * must never be presented as a measurement.
 */
export function isAxisAlignedRectangle(ring: number[][]): boolean {
  const r = openOutline(ring);
  if (r.length !== 4) return false;
  const EPS = 1e-6;
  for (let i = 0; i < 4; i++) {
    const a = r[i];
    const b = r[(i + 1) % 4];
    const dx = Math.abs(a[0] - b[0]);
    const dy = Math.abs(a[1] - b[1]);
    if (dx > EPS && dy > EPS) return false;
  }
  return true;
}

/** Validate ONE structure outline against every invariant. */
export function checkOutline(ring: number[][]): OutlineCheck {
  const problems: OutlineProblem[] = [];
  const r = openOutline(ring ?? []);
  if (r.length < 3) problems.push("too_few_points");
  if (hasDuplicateVertex(r)) problems.push("duplicate_vertex");
  if (isSelfIntersecting(r)) problems.push("self_intersecting");
  if (isAxisAlignedRectangle(r)) problems.push("axis_aligned_rectangle");
  return { ok: problems.length === 0, problems };
}

/**
 * A trace result must carry exactly one polygon per structure. Anything else is
 * facet decomposition sneaking back in.
 */
export function checkTraceResult(
  structures: Array<{ rings: number[][][] }>,
): { ok: boolean; problems: Array<OutlineProblem | "multiple_polygons"> } {
  const problems: Array<OutlineProblem | "multiple_polygons"> = [];
  for (const structure of structures) {
    if (structure.rings.length !== 1) problems.push("multiple_polygons");
    for (const ring of structure.rings) problems.push(...checkOutline(ring).problems);
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}
