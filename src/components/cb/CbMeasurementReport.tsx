import { useQuery } from "@tanstack/react-query";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { loadCbRoofPlan, CB_EDGE_COLORS, type CbPlan } from "@/lib/cbRoofPlan";

export interface CbMeasurementReportData {
  total_area_sqft: number;
  total_squares: number;
  waste_pct: number;
  pitch: string | null;
  eave_lf: number;
  ridge_lf: number;
  hip_lf: number;
  valley_lf: number;
  rake_lf: number;
}

const n0 = (v: number) => Math.round(Number(v) || 0).toLocaleString();

/** Satellite still with the traced footprint and labelled lines painted on. */
function diagramUrl(token: string | undefined, plan: CbPlan | undefined, lat: number | null, lng: number | null) {
  if (!token) return null;

  const features: unknown[] = [];
  for (const s of plan?.sections ?? []) {
    if (s.ring.length < 3) continue;
    const ring = [...s.ring.map((p) => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))])];
    ring.push(ring[0]);
    features.push({
      type: "Feature",
      properties: {
        fill: s.color || "#f97316",
        "fill-opacity": 0.42,
        stroke: "#2563eb",
        "stroke-width": 3,
        "stroke-opacity": 1,
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }
  for (const l of plan?.lines ?? []) {
    if (!l.coords || l.coords.length < 2) continue;
    features.push({
      type: "Feature",
      properties: {
        stroke: CB_EDGE_COLORS[l.type] ?? "#f59e0b",
        "stroke-width": 4,
        "stroke-opacity": 1,
      },
      geometry: {
        type: "LineString",
        coordinates: l.coords.map((p) => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))]),
      },
    });
  }

  const size = "900x620@2x";
  if (features.length > 0) {
    const overlay = encodeURIComponent(JSON.stringify({ type: "FeatureCollection", features }));
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/geojson(${overlay})/auto/${size}?padding=70&access_token=${token}`;
    if (url.length < 8000) return url;
  }
  if (lat == null || lng == null) return null;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},19,0/${size}?access_token=${token}`;
}

export function CbMeasurementReport({
  jobId,
  measurement,
  lat,
  lng,
}: {
  jobId: string;
  measurement: CbMeasurementReportData | null;
  lat: number | null;
  lng: number | null;
}) {
  const { data: token } = useMapboxToken();
  const { data: plan } = useQuery({
    queryKey: ["cb-plan-diagram", jobId],
    queryFn: () => loadCbRoofPlan(jobId),
    staleTime: 5 * 60 * 1000,
  });

  const url = diagramUrl(token, plan, lat, lng);
  const m = measurement;

  const tiles: [string, string][] = [
    ["Roof area SF", n0(m?.total_area_sqft ?? 0)],
    ["With waste (SQ)", (Number(m?.total_squares ?? 0) || 0).toFixed(1)],
    ["Eaves LF", n0(m?.eave_lf ?? 0)],
    ["Ridges LF", n0(m?.ridge_lf ?? 0)],
    ["Hips LF", n0(m?.hip_lf ?? 0)],
    ["Valleys LF", n0(m?.valley_lf ?? 0)],
    ["Rakes LF", n0(m?.rake_lf ?? 0)],
    ["Pitch", m?.pitch || "—"],
  ];

  return (
    <div
      className="est-page mx-auto w-full max-w-[1100px] rounded-2xl bg-white p-5 sm:p-8"
      style={{ boxShadow: "0 10px 40px rgba(15,23,42,.08)" }}
    >
      <h3 className="cb-display text-[22px] font-bold text-neutral-900 sm:text-[26px]">
        Measurement Report
      </h3>
      <div className="mt-3 h-[2px] w-full bg-neutral-900" />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {url ? (
          <img
            src={url}
            alt="Roof footprint over the satellite view"
            className="w-full rounded-xl border border-neutral-200 object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="flex h-56 items-center justify-center rounded-xl border border-neutral-200 text-[13px] text-neutral-500">
            No roof diagram on file
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                {label}
              </p>
              <p className="cb-num mt-1 text-[22px] font-bold text-neutral-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
