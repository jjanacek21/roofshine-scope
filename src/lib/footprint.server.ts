/**
 * Building footprint lookup (server only).
 *
 * The accuracy of an instant measurement is bounded by how well we know the
 * true outline of the building. Without a real footprint, callers fall back to
 * Google's roof-segment bounding boxes -- and because those boxes are
 * axis-aligned, the fallback can only ever produce a north-aligned rectangle.
 * That rectangle is what makes every roof render as a box with an X through it.
 *
 * Two sources, in order:
 *
 *   1. `building_footprint_at_point` on the storm database. Server-side
 *      Overpass with correct headers, and every footprint it fetches is cached
 *      in PostGIS -- so re-measuring a house never touches the network, and
 *      neighbouring buildings returned by the same query are cached for free.
 *
 *   2. Direct Overpass, as a fallback if the storm project is unreachable.
 *
 * IMPORTANT: Overpass returns 406 Not Acceptable to requests without a
 * User-Agent. The previous version of this file sent only Content-Type, so
 * every single lookup 406'd, both mirrors failed identically, and the silent
 * `catch {}` made it indistinguishable from "no building here". Do not remove
 * the User-Agent header.
 */

import { stormSupabase } from "@/integrations/storm/client";

export type FootprintResult = {
  /** Closed ring in [lng, lat]. */
  ring: number[][];
  /**
   * Where the outline came from. `segment_boxes` is never returned by this
   * module -- it's the caller's fallback, kept here so callers can label it.
   */
  source: "osm_cache" | "osm_live" | "osm_direct" | "segment_boxes";
  /** Footprint area from PostGIS, when the RPC provided it. */
  areaSqft?: number | null;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Overpass blocks requests without a User-Agent. This is not optional. */
const OVERPASS_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": "RoofShine-Scope/1.0 (roof measurement; j.janacek21@gmail.com)",
  Accept: "application/json",
};

type OverpassWay = {
  type: string;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
};

type FootprintRpcRow = {
  ring?: number[][] | null;
  area_sqft?: number | null;
  source?: string | null;
  source_id?: string | null;
  cached?: boolean | null;
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

function isUsableRing(ring: unknown): ring is number[][] {
  return (
    Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]),
    )
  );
}

/** Cached, server-side lookup. Preferred path. */
async function fromStormCache(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<FootprintResult | null> {
  const { data, error } = await stormSupabase.rpc("building_footprint_at_point" as never, {
    p_lat: lat,
    p_lng: lng,
    p_radius_m: Math.round(radiusM),
  } as never);

  if (error) {
    console.warn("[footprint] storm RPC failed:", error.message);
    return null;
  }

  const row = data as FootprintRpcRow | null;
  if (!row || !isUsableRing(row.ring)) return null;

  return {
    ring: row.ring,
    source: row.cached ? "osm_cache" : "osm_live",
    areaSqft: row.area_sqft ?? null,
  };
}

/** Direct Overpass. Only used if the storm RPC is unavailable. */
async function fromOverpassDirect(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<FootprintResult | null> {
  const query = `[out:json][timeout:12];(way["building"](around:${radiusM},${lat},${lng}););out geom;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: OVERPASS_HEADERS,
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // A non-OK status is a throttle or a rejected request -- NOT "no building
      // here". Say so, then try the next mirror.
      if (!res.ok) {
        console.warn(`[footprint] ${endpoint} returned ${res.status}`);
        continue;
      }

      // Overpass answers HTML on overload even with a 200 in some cases.
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        console.warn(`[footprint] ${endpoint} sent ${contentType || "unknown content-type"}`);
        continue;
      }

      const json = (await res.json()) as { elements?: OverpassWay[] };
      const rings: number[][][] = [];
      for (const el of json.elements ?? []) {
        if (el.type !== "way" || !el.geometry || el.geometry.length < 4) continue;
        rings.push(el.geometry.map((g) => [g.lon, g.lat]));
      }

      // A well-formed empty answer is authoritative: OSM has nothing here.
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
      return { ring: best, source: "osm_direct" };
    } catch (err) {
      console.warn(
        `[footprint] ${endpoint} threw:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return null;
}

/**
 * Fetch the building outline containing (or nearest to) a point.
 *
 * Returns null only when no footprint could be found. Callers then fall back to
 * geometry derived from Google's segment boxes -- which is always a north-aligned
 * rectangle, so surface that to the user rather than presenting it as measured.
 */
export async function fetchBuildingFootprint(
  lat: number,
  lng: number,
  radiusM = 30,
): Promise<FootprintResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  let cached: FootprintResult | null = null;
  try {
    cached = await fromStormCache(lat, lng, radiusM);
  } catch (err) {
    console.warn(
      "[footprint] storm cache path threw:",
      err instanceof Error ? err.message : String(err),
    );
  }

  /*
   * The cache RPC returns the building NEAREST the point, which on a tight
   * suburban lot is regularly the neighbour's house. If the pin does not sit
   * inside the ring it handed back, ask Overpass directly -- that path prefers
   * the building the pin is actually inside -- and only fall back to the
   * nearest-building answer when Overpass has nothing better.
   */
  if (cached && pointInRing(lng, lat, cached.ring)) return cached;

  const direct = await fromOverpassDirect(lat, lng, radiusM);
  if (direct && pointInRing(lng, lat, direct.ring)) return direct;

  return cached ?? direct;
}
