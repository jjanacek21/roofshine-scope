/**
 * Building footprint lookup (server only).
 *
 * The accuracy of an instant measurement is bounded by how well we know the
 * true outline of the building. OpenStreetMap carries the Microsoft/Esri US
 * building-footprint imports, which is the same data Mapbox's `building` layer
 * is built from, and it's free + keyless — so it's the primary source.
 */

export type FootprintResult = {
  /** Closed ring in [lng, lat]. */
  ring: number[][];
  source: "osm" | "segment_boxes";
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type OverpassWay = {
  type: string;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function centroid(ring: number[][]): [number, number] {
  const n = ring.length;
  return [
    ring.reduce((s, p) => s + p[0], 0) / n,
    ring.reduce((s, p) => s + p[1], 0) / n,
  ];
}

/**
 * Fetch the building outline containing (or nearest to) a point.
 * Returns null when OSM has no building there — callers fall back to geometry
 * derived from Google's segment boxes.
 */
export async function fetchBuildingFootprint(
  lat: number,
  lng: number,
  radiusM = 30,
): Promise<FootprintResult | null> {
  const query = `[out:json][timeout:12];(way["building"](around:${radiusM},${lat},${lng}););out geom;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { elements?: OverpassWay[] };
      const rings: number[][][] = [];
      for (const el of json.elements ?? []) {
        if (el.type !== "way" || !el.geometry || el.geometry.length < 4) continue;
        rings.push(el.geometry.map((g) => [g.lon, g.lat]));
      }
      if (rings.length === 0) return null;

      // Prefer the building the pin actually sits inside; otherwise the closest.
      const containing = rings.filter((r) => pointInRing(lng, lat, r));
      const pool = containing.length > 0 ? containing : rings;
      let best = pool[0];
      let bestD = Infinity;
      for (const r of pool) {
        const [cx, cy] = centroid(r);
        const d = Math.hypot(cx - lng, cy - lat);
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }
      return { ring: best, source: "osm" };
    } catch {
      // try the next mirror
    }
  }
  return null;
}
