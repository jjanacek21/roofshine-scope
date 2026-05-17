// Roof math helpers
// All distances in feet, areas in square feet.

export const PITCH_OPTIONS = [
  "0/12", "1/12", "2/12", "3/12", "4/12", "5/12", "6/12",
  "7/12", "8/12", "9/12", "10/12", "11/12", "12/12",
] as const;

export type Pitch = typeof PITCH_OPTIONS[number];

export function pitchMultiplier(pitch: string): number {
  const m = pitch.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return 1;
  const rise = Number(m[1]);
  const run = Number(m[2]);
  if (run === 0) return 1;
  return Math.sqrt(1 + (rise / run) ** 2);
}

/** Square feet → roofing squares (1 square = 100 sqft). */
export function squares(sqft: number): number {
  return sqft / 100;
}

/** Apply waste % to area. */
export function withWaste(sqft: number, wastePct: number): number {
  return sqft * (1 + wastePct / 100);
}

/** Bundles needed (3 bundles per square typical 3-tab; we expose default 3). */
export function bundles(sqft: number, wastePct: number, perSquare = 3): number {
  return Math.ceil(squares(withWaste(sqft, wastePct)) * perSquare);
}

// ---------- Geo helpers (no library required for haversine) ----------

const R = 20925524.9; // Earth radius in feet

export function haversineFeet(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Polygon ring [[lng,lat],...] (closed or open). Returns plan area in sqft via spherical excess approx. */
export function polygonAreaSqft(ring: number[][]): number {
  if (ring.length < 3) return 0;
  // Close the ring if not already closed
  const closed =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring
      : [...ring, ring[0]];
  // Project to local equirectangular around first point and use shoelace
  const lat0 = (closed[0][1] * Math.PI) / 180;
  const cosLat = Math.cos(lat0);
  const ftPerDegLat = 364320; // ~ feet per degree latitude
  const ftPerDegLng = ftPerDegLat * cosLat;
  const pts = closed.map(([lng, lat]) => ({
    x: (lng - closed[0][0]) * ftPerDegLng,
    y: (lat - closed[0][1]) * ftPerDegLat,
  }));
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    s += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
  }
  return Math.abs(s) / 2;
}

/** Lengths (ft) of each edge in a polygon ring. Returns N edges for N-gon. */
export function polygonEdgeLengths(ring: number[][]): number[] {
  if (ring.length < 2) return [];
  const closed =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring
      : [...ring, ring[0]];
  const lengths: number[] = [];
  for (let i = 0; i < closed.length - 1; i++) {
    lengths.push(
      haversineFeet(
        { lng: closed[i][0], lat: closed[i][1] },
        { lng: closed[i + 1][0], lat: closed[i + 1][1] },
      ),
    );
  }
  return lengths;
}

/** Length of a polyline in feet. */
export function lineStringLengthFeet(coords: number[][]): number {
  let s = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    s += haversineFeet(
      { lng: coords[i][0], lat: coords[i][1] },
      { lng: coords[i + 1][0], lat: coords[i + 1][1] },
    );
  }
  return s;
}

export const EDGE_TYPES = [
  "eave", "rake", "hip", "ridge", "valley",
  "gutter", "wall_flashing", "step_flashing", "transition",
  "parapet_wall", "drip_edge",
] as const;
export type EdgeType = typeof EDGE_TYPES[number];

export const LINE_TYPES = ["unlabeled", ...EDGE_TYPES] as const;
export type LineType = typeof LINE_TYPES[number];

export const EDGE_LABELS: Record<EdgeType, string> = {
  eave: "Eave",
  rake: "Rake",
  hip: "Hip",
  ridge: "Ridge",
  valley: "Valley",
  gutter: "Gutter",
  wall_flashing: "Wall Flashing",
  step_flashing: "Step Flashing",
  transition: "Transition",
  parapet_wall: "Parapet Wall",
  drip_edge: "Drip Edge",
};

export const LINE_LABELS: Record<LineType, string> = {
  unlabeled: "Unlabeled",
  ...EDGE_LABELS,
};

export const EDGE_COLORS: Record<EdgeType, string> = {
  eave: "#3b82f6",        // blue
  rake: "#8b5cf6",        // violet
  hip: "#ef4444",         // red
  ridge: "#f59e0b",       // amber
  valley: "#10b981",      // emerald
  gutter: "#14b8a6",      // teal
  wall_flashing: "#ec4899", // pink
  step_flashing: "#f97316", // orange
  transition: "#06b6d4",  // cyan
  parapet_wall: "#6366f1", // indigo
  drip_edge: "#84cc16",   // lime
};

export const LINE_COLORS: Record<LineType, string> = {
  unlabeled: "#ffffff",
  ...EDGE_COLORS,
};
