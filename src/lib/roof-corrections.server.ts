/**
 * Saved roof corrections — the "memory" behind AI measurements.
 *
 * When a user drags facet corners into place we store the corrected rings in
 * `roof_corrections`. Later AI runs on the same house reuse that geometry, and
 * runs elsewhere get a gentle area calibration learned from every correction
 * the company has made.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type CorrectionFacet = {
  ring: number[][];
  pitch: string;
  pitch_degrees: number;
  plan_area_sqft: number;
};

export type StoredCorrection = {
  id: string;
  lat: number;
  lng: number;
  pitch: string | null;
  corrected_facets: CorrectionFacet[];
  corrected_plan_sqft: number;
  created_at: string;
  structure_key?: string | null;
};

const M_PER_DEG_LAT = 111_320;

export function metersBetween(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dy = (bLat - aLat) * M_PER_DEG_LAT;
  const dx =
    (bLng - aLng) * M_PER_DEG_LAT * Math.max(0.1, Math.cos((aLat * Math.PI) / 180));
  return Math.hypot(dx, dy);
}

/** Most recent correction within `radiusM` of the pin (same property wins). */
export async function findNearbyCorrection(
  admin: SupabaseClient,
  opts: {
    lat: number;
    lng: number;
    companyId: string | null;
    propertyId?: string | null;
    radiusM?: number;
  },
): Promise<StoredCorrection | null> {
  const radius = opts.radiusM ?? 15;
  const dLat = (radius * 2) / M_PER_DEG_LAT;
  const dLng = dLat / Math.max(0.1, Math.cos((opts.lat * Math.PI) / 180));

  let q = admin
    .from("roof_corrections")
    .select("id, lat, lng, pitch, corrected_facets, corrected_plan_sqft, created_at, property_id, structure_key")
    .gte("lat", opts.lat - dLat)
    .lte("lat", opts.lat + dLat)
    .gte("lng", opts.lng - dLng)
    .lte("lng", opts.lng + dLng)
    .order("created_at", { ascending: false })
    .limit(25);
  if (opts.companyId) q = q.eq("company_id", opts.companyId);

  const { data } = await q;
  const rows = (data ?? []) as Array<StoredCorrection & { property_id: string | null }>;
  const usable = rows.filter(
    (r) =>
      Array.isArray(r.corrected_facets) &&
      r.corrected_facets.length > 0 &&
      metersBetween(opts.lat, opts.lng, Number(r.lat), Number(r.lng)) <= radius,
  );
  if (usable.length === 0) return null;
  const samePropertyFirst =
    (opts.propertyId && usable.find((r) => r.property_id === opts.propertyId)) || usable[0];
  return samePropertyFirst;
}

export type Calibration = {
  factor: number;
  samples: number;
};

/**
 * Median corrected/AI area ratio across the company's corrections. Clamped so
 * one bad edit can never skew a measurement, and ignored below 3 samples.
 */
export async function companyCalibration(
  admin: SupabaseClient,
  companyId: string | null,
): Promise<Calibration> {
  if (!companyId) return { factor: 1, samples: 0 };
  const { data } = await admin
    .from("roof_corrections")
    .select("corrected_plan_sqft, ai_plan_sqft")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  const ratios = (data ?? [])
    .map((r) => Number(r.corrected_plan_sqft) / Math.max(1, Number(r.ai_plan_sqft)))
    .filter((v) => Number.isFinite(v) && v > 0.3 && v < 3);
  if (ratios.length < 3) return { factor: 1, samples: ratios.length };

  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const median =
    ratios.length % 2 === 0 ? (ratios[mid - 1] + ratios[mid]) / 2 : ratios[mid];
  const factor = Math.min(1.25, Math.max(0.8, median));
  return { factor: Math.round(factor * 1000) / 1000, samples: ratios.length };
}

/** Scale a closed ring about its centroid so its area changes by `factor`. */
export function scaleRing(ring: number[][], factor: number): number[][] {
  if (!Array.isArray(ring) || ring.length < 3 || factor === 1) return ring;
  const k = Math.sqrt(factor);
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return ring.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}
