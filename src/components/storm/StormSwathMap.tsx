import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Download, Save, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { stormSupabase } from "@/integrations/storm/client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { HOUSE_CIRCLE_MIN_ZOOM } from "@/lib/storm-config";
import { RoofMeasureCard, type MeasureSnapshot } from "@/components/storm/RoofMeasureCard";
import { StormMailerModal } from "@/components/storm/StormMailerModal";


type FC = { type: "FeatureCollection"; features: any[] };
const EMPTY_FC: FC = { type: "FeatureCollection", features: [] };

const HAIL_MAX_DAYS = 60;
const WIND_MIN_MPH = 60;
const MAP_READY_TIMEOUT_MS = 2_500;

type RangeKey = "24h" | "3d" | "1w" | "1mo" | "3mo" | "6mo" | "1y";
const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: "24h", label: "Last 24 hours", days: 2 },
  { key: "3d", label: "Last 3 days", days: 3 },
  { key: "1w", label: "Last 1 week", days: 7 },
  { key: "1mo", label: "Last 1 month", days: 30 },
  { key: "3mo", label: "Last 3 months", days: 90 },
  { key: "6mo", label: "Last 6 months", days: 180 },
  { key: "1y", label: "Last 1 year", days: 365 },
];
const rangeDays = (k: RangeKey) => RANGE_OPTIONS.find((r) => r.key === k)?.days ?? 2;

const WIND_BANDS: { band: string; label: string; color: string; min: number; max: number }[] = [
  { band: "60-69", label: "60–69 mph", color: "#FFD400", min: 60, max: 69.999 },
  { band: "70-79", label: "70–79 mph", color: "#FFB74D", min: 70, max: 79.999 },
  { band: "80-89", label: "80–89 mph", color: "#FF8C00", min: 80, max: 89.999 },
  { band: "90-110", label: "90–110 mph", color: "#D0021B", min: 90, max: 110 },
  { band: "110+", label: "110+ mph", color: "#7B1FA2", min: 110.001, max: Infinity },
];

// Satellite imagery is what canvassers need — they identify the actual roof.
const SAFE_BASE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";


type SearchPoint = { lng: number; lat: number; label: string };
type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

type StormReport = {
  max_hail_in: number | null;
  max_wind_mph: number | null;
  hail_dates: { date: string; size_in: number | null; band?: string | null; color?: string | null }[];
  wind_dates: {
    date: string;
    wind_mph: number | null;
    source?: string | null;
    area?: string | null;
    distance_mi?: number | null;
  }[];
};

interface Props {
  center: [number, number];
  zoom?: number;
  searchedPoint?: SearchPoint | null;
}

function escapeHtml(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(`${d}`.length <= 10 ? `${d}T12:00:00Z` : d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toCsv(rows: Record<string, any>[]) {
  if (rows.length === 0) return "";
  const headers = Array.from(rows.reduce<Set<string>>((set, r) => {
    Object.keys(r).forEach((k) => set.add(k));
    return set;
  }, new Set()));
  const cell = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\r\n");
}

export function StormSwathMap({ center, zoom = 4, searchedPoint = null }: Props) {
  const { data: token, error: tokenError } = useMapboxToken();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const swathPopupRef = useRef<mapboxgl.Popup | null>(null);
  const readyRef = useRef(false);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const retryCountRef = useRef(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initMapRef = useRef<(() => void) | null>(null);
  const setPointRef = useRef<((p: SearchPoint) => void) | null>(null);

  const [styleReady, setStyleReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<RangeKey>("24h");
  const [showHail, setShowHail] = useState(true);
  const [showWind, setShowWind] = useState(true);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [point, setPoint] = useState<SearchPoint | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [measure, setMeasure] = useState<MeasureSnapshot | null>(null);
  const [facets, setFacets] = useState<any[]>([]);
  const [mailerOpen, setMailerOpen] = useState(false);



  const days = rangeDays(rangeKey);
  const hailDays = Math.min(days, HAIL_MAX_DAYS);
  const hailClamped = days > HAIL_MAX_DAYS;

  useEffect(() => {
    centerRef.current = center;
    zoomRef.current = zoom;
  }, [center, zoom]);

  useEffect(() => {
    if (tokenError) toast.error(`Mapbox token: ${(tokenError as Error).message}`);
  }, [tokenError]);

  const bboxKey = bbox
    ? [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat].map((n) => n.toFixed(3)).join(",")
    : "";

  const { data: hail = EMPTY_FC, isFetching: hailLoading } = useQuery({
    queryKey: ["storm-hail-view", bboxKey, hailDays, showHail],
    enabled: !!bbox && showHail,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("hail_swaths_in_view" as any, {
        p_min_lon: bbox!.minLon,
        p_min_lat: bbox!.minLat,
        p_max_lon: bbox!.maxLon,
        p_max_lat: bbox!.maxLat,
        p_days: hailDays,
      });
      if (error) {
        toast.error(`Hail layer: ${error.message}`);
        throw error;
      }
      return ((data as FC) ?? EMPTY_FC) as FC;
    },
  });

  const { data: wind = EMPTY_FC, isFetching: windLoading } = useQuery({
    queryKey: ["storm-wind-view", bboxKey, days, showWind],
    enabled: !!bbox && showWind,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("wind_swaths_in_view" as any, {
        p_min_lon: bbox!.minLon,
        p_min_lat: bbox!.minLat,
        p_max_lon: bbox!.maxLon,
        p_max_lat: bbox!.maxLat,
        p_days: days,
        p_min_mph: WIND_MIN_MPH,
      });
      if (error) {
        toast.error(`Wind layer: ${error.message}`);
        throw error;
      }
      return ((data as FC) ?? EMPTY_FC) as FC;
    },
  });

  const { data: report, isFetching: reportLoading } = useQuery({
    queryKey: ["storm-point-report", point?.lat, point?.lng],
    enabled: !!point,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("storm_report_at_point" as any, {
        p_lat: point!.lat,
        p_lng: point!.lng,
        p_hail_days: 60,
        p_wind_days: 365,
        p_wind_radius_mi: 3,
      });
      if (error) {
        toast.error(`Storm report: ${error.message}`);
        throw error;
      }
      return (data ?? null) as StormReport | null;
    },
  });

  const { data: savedRows = [], isFetching: savedLoading } = useQuery({
    queryKey: ["storm-saved-dispositions"],
    enabled: savedOpen && !!user,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("export_storm_dispositions" as any, {
        p_only_storm_map: false,
      });
      if (error) {
        toast.error(`Saved properties: ${error.message}`);
        throw error;
      }
      return (data ?? []) as Record<string, any>[];
    },
  });

  // ---- map init -------------------------------------------------------
  useEffect(() => {
    if (!token) return;
    if (!containerRef.current) return;

    const destroyMap = () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
      try { roRef.current?.disconnect(); } catch { /* noop */ }
      roRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      swathPopupRef.current?.remove();
      swathPopupRef.current = null;
      try { mapRef.current?.remove(); } catch { /* noop */ }
      mapRef.current = null;
      readyRef.current = false;
      setStyleReady(false);
    };

    const publishBounds = (map: mapboxgl.Map) => {
      const b = map.getBounds();
      if (!b) return;
      setBbox({
        minLon: b.getWest(),
        minLat: b.getSouth(),
        maxLon: b.getEast(),
        maxLat: b.getNorth(),
      });
    };

    const setupLayers = (map: mapboxgl.Map) => {
      if (readyRef.current) return;
      const addSrc = (id: string) => {
        if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY_FC as any });
      };
      const addLyr = (cfg: any) => {
        if (!map.getLayer(cfg.id)) map.addLayer(cfg);
      };

      addSrc("hail-swaths");
      addSrc("wind-swaths");
      addSrc("roof-facets");

      // Building footprints — only at canvassing zoom so the view stays clean.
      if (!map.getSource("mb-streets")) {
        map.addSource("mb-streets", { type: "vector", url: "mapbox://mapbox.mapbox-streets-v8" });
      }
      addLyr({
        id: "house-footprints",
        type: "fill",
        source: "mb-streets",
        "source-layer": "building",
        minzoom: HOUSE_CIRCLE_MIN_ZOOM,
        paint: {
          "fill-color": "#38bdf8",
          "fill-opacity": 0.18,
          "fill-outline-color": "#38bdf8",
        },
      });



      for (const key of ["hail", "wind"] as const) {
        addLyr({
          id: `${key}-fill`,
          type: "fill",
          source: `${key}-swaths`,
          paint: {
            "fill-color": ["coalesce", ["get", "color"], key === "hail" ? "#FFD400" : "#2563eb"],
            "fill-opacity": 0.45,
          },
        });
        addLyr({
          id: `${key}-line`,
          type: "line",
          source: `${key}-swaths`,
          paint: {
            "line-color": ["coalesce", ["get", "color"], key === "hail" ? "#FFD400" : "#2563eb"],
            "line-width": 1,
            "line-opacity": 0.9,
          },
        });
      }

      // Measured roof facets for the selected house.
      addLyr({
        id: "roof-facets-fill",
        type: "fill",
        source: "roof-facets",
        paint: { "fill-color": ["coalesce", ["get", "color"], "#38bdf8"], "fill-opacity": 0.35 },
      });
      addLyr({
        id: "roof-facets-line",
        type: "line",
        source: "roof-facets",
        paint: { "line-color": "#fbbf24", "line-width": 1.5 },
      });

      const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true });
      swathPopupRef.current = popup;

      map.on("mouseenter", "house-footprints", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "house-footprints", () => (map.getCanvas().style.cursor = ""));


      for (const layer of ["hail-fill", "wind-fill"]) {
        map.on("click", layer, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p: any = f.properties ?? {};
          const label = p.label ?? `${fmtDate(p.event_date)} — ${p.band ?? ""}`;
          popup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-family:system-ui;font-size:12px;line-height:1.45;color:#0a0a0b"><b>${escapeHtml(label)}</b></div>`,
            )
            .addTo(map);
        });
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      map.on("click", (e) => {
        // A house click always wins over a swath click at canvassing zoom.
        const houseHit =
          map.getZoom() >= HOUSE_CIRCLE_MIN_ZOOM &&
          map.queryRenderedFeatures(e.point, { layers: ["house-footprints"] }).length > 0;
        if (!houseHit) {
          const hits = map.queryRenderedFeatures(e.point, { layers: ["hail-fill", "wind-fill"] });
          if (hits.length > 0) return;
        }
        setPointRef.current?.({
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
          label: `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`,
        });
      });


      map.on("moveend", () => publishBounds(map));

      readyRef.current = true;
      publishBounds(map);
      setStyleReady(true);
    };

    const initMap = () => {
      if (mapRef.current) return;
      const c = containerRef.current;
      if (!c) return;

      mapboxgl.accessToken = token;
      let map: mapboxgl.Map;
      try {
        map = new mapboxgl.Map({
          container: c,
          style: SAFE_BASE_STYLE as any,
          center: centerRef.current,
          zoom: zoomRef.current,
          attributionControl: true,
        });
      } catch (err) {
        console.error("[StormMap] failed to construct map:", err);
        setInitError("Failed to initialize map");
        return;
      }
      mapRef.current = map;
      setInitError(null);

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
      map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-right");

      const ro = new ResizeObserver(() => {
        try { map.resize(); } catch { /* noop */ }
      });
      ro.observe(c);
      roRef.current = ro;
      requestAnimationFrame(() => { try { map.resize(); } catch { /* noop */ } });

      map.on("error", (e: any) => console.error("[StormMap] map error:", e?.error ?? e));

      const markReady = () => {
        if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
        try {
          setupLayers(map);
        } catch (err) {
          console.error("[StormMap] setupLayers failed:", err);
          setInitError("Map failed to load");
        }
      };

      const scheduleReadyFallback = () => {
        if (readyTimerRef.current || readyRef.current) return;
        readyTimerRef.current = setTimeout(() => {
          if (readyRef.current) return;
          try {
            if (map.isStyleLoaded() || map.loaded()) markReady();
          } catch { /* noop */ }
        }, MAP_READY_TIMEOUT_MS);
      };

      watchdogRef.current = setTimeout(() => {
        if (readyRef.current) return;
        if (retryCountRef.current === 0) {
          retryCountRef.current = 1;
          destroyMap();
          initMap();
        } else {
          destroyMap();
          setInitError("Map failed to load");
        }
      }, 8000);

      map.once("style.load", markReady);
      map.once("load", markReady);
      map.once("idle", markReady);
      map.on("styledata", scheduleReadyFallback);

      map.getCanvas().addEventListener(
        "webglcontextlost",
        (ev: Event) => {
          ev.preventDefault();
          destroyMap();
          initMap();
        },
        { once: true },
      );

      requestAnimationFrame(() => {
        try {
          if (map.isStyleLoaded() || map.loaded()) markReady();
          else scheduleReadyFallback();
        } catch {
          scheduleReadyFallback();
        }
      });
    };

    initMapRef.current = initMap;
    initMap();

    return () => {
      initMapRef.current = null;
      destroyMap();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  setPointRef.current = (p: SearchPoint) => setPoint(p);

  // ---- data → layers --------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("hail-swaths") as mapboxgl.GeoJSONSource | undefined)?.setData(
      (showHail ? hail : EMPTY_FC) as any,
    );
  }, [hail, showHail, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("wind-swaths") as mapboxgl.GeoJSONSource | undefined)?.setData(
      (showWind ? wind : EMPTY_FC) as any,
    );
  }, [wind, showWind, styleReady]);

  // ---- marker for the active point ------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!map || !point) return;
    markerRef.current = new mapboxgl.Marker({ color: "#3b82f6" })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
  }, [point, styleReady]);

  // ---- external search point ------------------------------------------
  useEffect(() => {
    if (!searchedPoint) return;
    setPoint(searchedPoint);
    const map = mapRef.current;
    map?.flyTo({ center: [searchedPoint.lng, searchedPoint.lat], zoom: 18, essential: true });
  }, [searchedPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || searchedPoint) return;
    map.flyTo({ center, zoom, essential: true });
  }, [center, zoom, searchedPoint]);

  // ---- legend counts ---------------------------------------------------
  const windCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of WIND_BANDS) counts[b.band] = 0;
    for (const f of wind.features ?? []) {
      const p: any = f?.properties ?? {};
      const band = WIND_BANDS.find(
        (b) => b.band === p.band || (Number(p.min_mph) >= b.min && Number(p.min_mph) <= b.max),
      );
      if (band) counts[band.band] += 1;
    }
    return counts;
  }, [wind]);

  const hailLegend = useMemo(() => {
    const map = new Map<string, { band: string; color: string; count: number }>();
    for (const f of hail.features ?? []) {
      const p: any = f?.properties ?? {};
      const band = String(p.band ?? "hail");
      const entry = map.get(band) ?? { band, color: p.color ?? "#FFD400", count: 0 };
      entry.count += 1;
      map.set(band, entry);
    }
    return Array.from(map.values());
  }, [hail]);

  const handleSaveLead = useCallback(async () => {
    if (!point) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_storm_disposition" as any, {
      p_lat: point.lat,
      p_lng: point.lng,
      p_address: point.label,
      p_disposition: "storm_damage",
      p_notes: null,
      p_storm: (report ?? {}) as any,
    });
    setSaving(false);
    if (error) {
      toast.error(`Could not save lead: ${error.message}`);
      return;
    }
    toast.success("Saved as storm damage lead");
    queryClient.invalidateQueries({ queryKey: ["storm-saved-dispositions"] });
  }, [point, report, queryClient]);

  const handleExportCsv = useCallback(async () => {
    const { data, error } = await supabase.rpc("export_storm_dispositions" as any, {
      p_only_storm_map: false,
    });
    if (error) {
      toast.error(`Export failed: ${error.message}`);
      return;
    }
    const rows = (data ?? []) as Record<string, any>[];
    if (rows.length === 0) {
      toast.error("No saved properties to export");
      return;
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storm-dispositions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} properties`);
  }, []);

  const dataLoading = hailLoading || windLoading;
  const showOverlay = !token || !styleReady;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Controls + legend */}
      <div
        className="absolute top-4 left-4 z-10 flex w-[230px] flex-col gap-2 rounded-lg border p-3 text-[11px] shadow-lg"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "rgba(10,10,11,0.88)",
          color: "var(--text-dim)",
        }}
      >
        <label className="font-semibold text-foreground" htmlFor="storm-range">
          Time range
        </label>
        <select
          id="storm-range"
          value={rangeKey}
          onChange={(e) => setRangeKey(e.target.value as RangeKey)}
          className="rounded-md border bg-transparent px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        >
          {RANGE_OPTIONS.map((r) => (
            <option key={r.key} value={r.key} style={{ background: "#0a0a0b" }}>
              {r.label}
            </option>
          ))}
        </select>
        {hailClamped && (
          <p className="text-[10px] leading-snug" style={{ color: "#FFD400" }}>
            Hail data is limited to the last 60 days.
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showHail} onChange={(e) => setShowHail(e.target.checked)} />
            Hail
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={showWind} onChange={(e) => setShowWind(e.target.checked)} />
            Wind
          </label>
          {dataLoading && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
        </div>

        <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="mb-1 font-semibold text-foreground">Wind bands</div>
          {WIND_BANDS.map((b) => (
            <div key={b.band} className="flex items-center gap-2 py-[1px]">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: b.color, border: "1px solid rgba(255,255,255,0.25)" }}
              />
              <span className="flex-1">{b.label}</span>
              <span className="font-mono text-foreground">{windCounts[b.band] ?? 0}</span>
            </div>
          ))}
        </div>

        {hailLegend.length > 0 && (
          <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="mb-1 font-semibold text-foreground">Hail bands</div>
            {hailLegend.map((h) => (
              <div key={h.band} className="flex items-center gap-2 py-[1px]">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: h.color, border: "1px solid rgba(255,255,255,0.25)" }}
                />
                <span className="flex-1">{h.band}</span>
                <span className="font-mono text-foreground">{h.count}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setSavedOpen((v) => !v)}
          className="mt-1 rounded-md border px-2 py-1 text-xs font-semibold text-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          {savedOpen ? "Hide saved properties" : "Saved properties"}
        </button>
      </div>

      {/* Point report panel */}
      {point && (
        <div
          className="absolute top-4 right-4 z-10 flex max-h-[70%] w-[300px] flex-col gap-2 overflow-auto rounded-lg border p-3 text-[11px] shadow-lg"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "rgba(10,10,11,0.92)",
            color: "var(--text-dim)",
          }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 text-xs font-semibold text-foreground">{point.label}</div>
            <button type="button" onClick={() => setPoint(null)} aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {reportLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading storm history…
            </div>
          )}

          {!reportLoading && report && (
            <>
              <div className="flex gap-3 font-mono text-foreground">
                <span>Max hail: {report.max_hail_in != null ? `${report.max_hail_in}"` : "—"}</span>
                <span>Max wind: {report.max_wind_mph != null ? `${report.max_wind_mph} mph` : "—"}</span>
              </div>

              <div>
                <div className="mb-1 font-semibold text-foreground">Hail — last 60 days</div>
                {(report.hail_dates ?? []).length === 0 ? (
                  <div className="opacity-70">No hail reported.</div>
                ) : (
                  (report.hail_dates ?? []).map((h, i) => (
                    <div key={i} className="flex items-center gap-2 py-[1px]">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ background: h.color ?? "#FFD400" }}
                      />
                      <span className="flex-1">{fmtDate(h.date)}</span>
                      <span className="font-mono text-foreground">
                        {h.size_in != null ? `${h.size_in}"` : h.band ?? ""}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div>
                <div className="mb-1 font-semibold text-foreground">Wind 60+ mph — last year</div>
                {(report.wind_dates ?? []).length === 0 ? (
                  <div className="opacity-70">No 60+ mph winds reported.</div>
                ) : (
                  (report.wind_dates ?? []).map((w, i) => (
                    <div key={i} className="flex items-center gap-2 py-[1px]">
                      <span className="flex-1">{fmtDate(w.date)}</span>
                      <span className="font-mono text-foreground">
                        {w.wind_mph != null ? `${w.wind_mph} mph` : "—"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {!user ? (
            <div
              className="mt-1 rounded-md px-2 py-1.5 text-center text-[11px]"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              Sign in to save leads
            </div>
          ) : (
          <button
            type="button"
            onClick={handleSaveLead}
            disabled={saving}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold"
            style={{ background: "var(--brand, #2563eb)", color: "#fff" }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save as storm damage lead
          </button>
          )}
        </div>
      )}

      {/* Saved properties panel */}
      {savedOpen && (
        <div
          className="absolute bottom-4 left-4 z-10 flex max-h-[45%] w-[320px] flex-col gap-2 overflow-auto rounded-lg border p-3 text-[11px] shadow-lg"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "rgba(10,10,11,0.92)",
            color: "var(--text-dim)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs font-semibold text-foreground">Saved properties</span>
            {user ? (
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold text-foreground"
              style={{ borderColor: "var(--border)" }}
            >
              <Download className="h-3 w-3" /> Export CSV
            </button>
            ) : (
              <span className="text-[11px] opacity-70">Sign in to save leads</span>
            )}
          </div>
          {savedLoading && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          )}
          {!user && <div className="opacity-70">Sign in to save and export leads.</div>}
          {user && !savedLoading && savedRows.length === 0 && (
            <div className="opacity-70">Nothing saved yet.</div>
          )}
          {savedRows.map((r, i) => (
            <div key={i} className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="text-foreground">{r.address ?? r.full_address ?? "—"}</div>
              <div className="opacity-70">
                {[r.disposition, r.customer_name, r.created_at ? fmtDate(r.created_at) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {initError ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ backgroundColor: "rgba(10,10,11,0.9)" }}
        >
          <div
            className="flex items-center gap-3 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg"
            style={{ borderColor: "var(--border)", backgroundColor: "rgba(10,10,11,0.9)", color: "#f87171" }}
          >
            <span>{initError}</span>
            <button
              type="button"
              onClick={() => {
                setInitError(null);
                retryCountRef.current = 0;
                initMapRef.current?.();
              }}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Reload map
            </button>
          </div>
        </div>
      ) : showOverlay ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          style={{ backgroundColor: "rgba(10,10,11,0.55)" }}
        >
          <div
            className="flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "rgba(10,10,11,0.9)",
              color: "var(--text-dim)",
            }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {!token ? "Authorizing map…" : "Loading basemap…"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
