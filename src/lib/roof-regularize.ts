/**
 * Polygon regularization for traced roof footprints.
 *
 * A tracer chasing pixels loses the roof edge wherever a shadow, a tree or a
 * same-coloured patio crosses it, and wraps the blob instead. Buildings are
 * rectilinear: if the run before and the run after are square, the piece in
 * between is square too. This snaps edge bearings onto the building's own
 * dominant axis, re-intersects them for clean corners, and drops the jitter.
 *
 * Pure geometry — safe on the server (post-process on the trace) and in the
 * browser (the editor's "square up" toggle).
 */

const FT_PER_DEG_LAT = 364320;

export interface RegularizeOptions {
  /** Bearings within this many degrees of the axis get snapped. */
  toleranceDeg?: number;
  /** Also snap to 45° off the dominant axis. */
  allow45?: boolean;
  /** Vertices deviating less than this from the neighbour line are dropped. */
  spurFt?: number;
  /** Turn smaller than this counts as collinear. */
  collinearDeg?: number;
  /** Force a dominant axis instead of deriving one. */
  axisDeg?: number;
}

export interface RegularizeResult {
  ring: number[][];
  /** Dominant building axis in degrees, 0–90. */
  axisDeg: number;
  areaBeforeSqft: number;
  areaAfterSqft: number;
  /** Signed percentage change in plan area. */
  areaDeltaPct: number;
  /** True when the area moved more than 3% — surface it, never hide it. */
  flagged: boolean;
  snappedEdges: number;
  removedVertices: number;
}

type Pt = { x: number; y: number };

function scaleAt(lat: number) {
  return { lat: FT_PER_DEG_LAT, lng: FT_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180) };
}

function shoelaceSqft(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

function norm180(deg: number): number {
  let d = deg % 180;
  if (d < 0) d += 180;
  return d;
}

/** Length-weighted histogram of edge bearings, folded into 0–90. */
export function dominantAxisDeg(pts: Pt[]): number {
  const bins = new Array(90).fill(0);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    const deg = norm180((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 90;
    // Spread over neighbouring bins so a 44.6/45.4 split still peaks together.
    for (let d = -2; d <= 2; d++) {
      const bin = (Math.round(deg) + d + 90) % 90;
      bins[bin] += len * (1 - Math.abs(d) / 3);
    }
  }
  let best = 0;
  let bestVal = -1;
  bins.forEach((v, i) => {
    if (v > bestVal) {
      bestVal = v;
      best = i;
    }
  });
  return best;
}

function intersect(p: Pt, dp: Pt, q: Pt, dq: Pt): Pt | null {
  const den = dp.x * dq.y - dp.y * dq.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q.x - p.x) * dq.y - (q.y - p.y) * dq.x) / den;
  return { x: p.x + dp.x * t, y: p.y + dp.y * t };
}

/** Perpendicular distance from b to the line a→c, in the same units. */
function deviation(a: Pt, b: Pt, c: Pt): number {
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return Math.hypot(b.x - a.x, b.y - a.y);
  return Math.abs((b.x - a.x) * vy - (b.y - a.y) * vx) / len;
}

/**
 * Snap an OPEN ring of [lng,lat] pairs onto the building's dominant axis.
 * Returns the original ring untouched when it is too small to reason about.
 */
export function regularizeRing(ring: number[][], opts: RegularizeOptions = {}): RegularizeResult {
  const toleranceDeg = opts.toleranceDeg ?? 18;
  const allow45 = opts.allow45 ?? true;
  const spurFt = opts.spurFt ?? 2;
  const collinearDeg = opts.collinearDeg ?? 8;

  const clean = ring.filter((p) => Array.isArray(p) && p.length >= 2);
  const n = clean.length;
  const fallback = (): RegularizeResult => ({
    ring,
    axisDeg: 0,
    areaBeforeSqft: 0,
    areaAfterSqft: 0,
    areaDeltaPct: 0,
    flagged: false,
    snappedEdges: 0,
    removedVertices: 0,
  });
  if (n < 4) return fallback();

  const lat0 = clean.reduce((s, p) => s + p[1], 0) / n;
  const lng0 = clean.reduce((s, p) => s + p[0], 0) / n;
  const s = scaleAt(lat0);
  const pts: Pt[] = clean.map((p) => ({ x: (p[0] - lng0) * s.lng, y: (p[1] - lat0) * s.lat }));

  const areaBefore = shoelaceSqft(pts);
  const axisDeg = opts.axisDeg ?? dominantAxisDeg(pts);
  const step = allow45 ? 45 : 90;

  // 1–2. Snap each edge bearing to the axis grid, within tolerance.
  let snappedEdges = 0;
  const dirs: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const raw = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const rel = raw - axisDeg;
    const target = Math.round(rel / step) * step;
    const diff = Math.abs(rel - target);
    const use = diff <= toleranceDeg ? axisDeg + target : raw;
    if (diff <= toleranceDeg && diff > 0.001) snappedEdges++;
    const rad = (use * Math.PI) / 180;
    dirs.push({ x: Math.cos(rad), y: Math.sin(rad) });
  }

  // 3. Re-intersect adjacent snapped edges for clean corners.
  const mids: Pt[] = pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  });
  let out: Pt[] = pts.map((p, i) => {
    const prev = (i - 1 + pts.length) % pts.length;
    const hit = intersect(mids[prev], dirs[prev], mids[i], dirs[i]);
    if (!hit) return p;
    // A wild intersection (near-parallel edges) must not fling a corner away.
    if (Math.hypot(hit.x - p.x, hit.y - p.y) > 40) return p;
    return hit;
  });

  // 4–5. Collapse near-collinear runs and drop spurs.
  let removedVertices = 0;
  let changed = true;
  while (changed && out.length > 4) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i - 1 + out.length) % out.length];
      const b = out[i];
      const c = out[(i + 1) % out.length];
      const t1 = Math.atan2(b.y - a.y, b.x - a.x);
      const t2 = Math.atan2(c.y - b.y, c.x - b.x);
      let turn = Math.abs(((t2 - t1) * 180) / Math.PI) % 360;
      if (turn > 180) turn = 360 - turn;
      if (turn < collinearDeg || deviation(a, b, c) < spurFt) {
        out = out.filter((_, idx) => idx !== i);
        removedVertices++;
        changed = true;
        break;
      }
    }
  }

  const areaAfter = shoelaceSqft(out);
  const areaDeltaPct = areaBefore > 0 ? ((areaAfter - areaBefore) / areaBefore) * 100 : 0;

  return {
    ring: out.map((p) => [lng0 + p.x / s.lng, lat0 + p.y / s.lat]),
    axisDeg,
    areaBeforeSqft: areaBefore,
    areaAfterSqft: areaAfter,
    areaDeltaPct,
    flagged: Math.abs(areaDeltaPct) > 3,
    snappedEdges,
    removedVertices,
  };
}

/**
 * Dominant axis of a lng/lat ring, for snapping a manually dragged vertex to
 * the same grid the footprint was regularized onto.
 */
export function ringAxisDeg(ring: number[][]): number {
  const n = ring.length;
  if (n < 3) return 0;
  const lat0 = ring.reduce((sum, p) => sum + p[1], 0) / n;
  const lng0 = ring.reduce((sum, p) => sum + p[0], 0) / n;
  const s = scaleAt(lat0);
  return dominantAxisDeg(ring.map((p) => ({ x: (p[0] - lng0) * s.lng, y: (p[1] - lat0) * s.lat })));
}

/**
 * Drag-time snapping: hold the two edges either side of the moved vertex on the
 * building grid when they are already close to it.
 */
export function snapVertexToAxis(
  ring: number[][],
  index: number,
  point: [number, number],
  axisDeg: number,
  toleranceDeg = 12,
): [number, number] {
  const n = ring.length;
  if (n < 3) return point;
  const s = scaleAt(point[1]);
  let out: [number, number] = point;
  for (const anchor of [ring[(index - 1 + n) % n], ring[(index + 1) % n]]) {
    if (!anchor) continue;
    const dx = (out[0] - anchor[0]) * s.lng;
    const dy = (out[1] - anchor[1]) * s.lat;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const rel = deg - axisDeg;
    const target = Math.round(rel / 45) * 45;
    if (Math.abs(rel - target) > toleranceDeg) continue;
    const rad = ((axisDeg + target) * Math.PI) / 180;
    out = [anchor[0] + (Math.cos(rad) * len) / s.lng, anchor[1] + (Math.sin(rad) * len) / s.lat];
    break;
  }
  return out;
}
