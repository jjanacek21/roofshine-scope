/**
 * Parcel lookup for map mode, cached hard.
 *
 * The Florida cadastral service is free but it is a public government
 * endpoint, so we treat every result as permanent: the assessment roll only
 * changes once a year. A parcel fetched once should never be fetched again on
 * the same device.
 */
import { useQuery } from "@tanstack/react-query";
import { isInFlorida, lookupFlParcel, type FlParcel } from "@/lib/parcels/fl-cadastral";

const STORE_PREFIX = "cb.parcel.v1.";
/** Roll year rolls over annually; 120 days keeps us fresh without re-fetching daily. */
const TTL_MS = 120 * 24 * 60 * 60 * 1000;

/** ~11m of precision. Two taps on the same roof hit the same cache entry. */
function cacheKey(lat: number, lng: number) {
  return `${STORE_PREFIX}${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function readCache(lat: number, lng: number): FlParcel | null | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(cacheKey(lat, lng));
    if (!raw) return undefined;
    const { at, value } = JSON.parse(raw) as { at: number; value: FlParcel | null };
    if (!at || Date.now() - at > TTL_MS) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

function writeCache(lat: number, lng: number, value: FlParcel | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(lat, lng), JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* Quota full or storage disabled — the query cache still covers this session. */
  }
}

export function useFlParcel(
  lat: number | null | undefined,
  lng: number | null | undefined,
  opts: { withGeometry?: boolean } = {},
) {
  const enabled =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    isInFlorida(lat, lng);

  const query = useQuery({
    queryKey: ["fl-parcel", lat?.toFixed(5), lng?.toFixed(5), !!opts.withGeometry],
    enabled,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const cached = readCache(lat!, lng!);
      if (cached !== undefined) return cached;
      const parcel = await lookupFlParcel(lat!, lng!, { ...opts, signal });
      writeCache(lat!, lng!, parcel);
      return parcel;
    },
  });

  return {
    ...query,
    /** True when the point is outside Florida, so the UI can say so rather than spin. */
    outOfCoverage: lat != null && lng != null && !enabled,
  };
}
