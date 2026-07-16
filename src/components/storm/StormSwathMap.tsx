import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { stormSupabase } from "@/integrations/storm/client";

type FC = { type: "FeatureCollection"; features: any[] };
const EMPTY_FC: FC = { type: "FeatureCollection", features: [] };
const HAIL_DAYS = 60;
const WIND_HOURS = 17_520;
const WIND_MIN_MPH = 60;
const PROPERTY_WIND_RADIUS_MILES = 0.5;
const HAIL_LOAD_CONCURRENCY = 4;
const HAIL_DATE_TIMEOUT_MS = 8_000;
const MAP_READY_TIMEOUT_MS = 2_500;

// Severity thresholds for "bad storm" highlighting
const BAD_HAIL_IN = 2.0;
const BAD_WIND_MPH = 75;

type RangeKey = "24h" | "72h" | "1w" | "1mo" | "3mo" | "6mo" | "1y" | "2y";
const RANGE_OPTIONS: { key: RangeKey; label: string; hours: number }[] = [
  { key: "24h", label: "24 hours", hours: 24 },
  { key: "72h", label: "72 hours", hours: 72 },
  { key: "1w", label: "1 week", hours: 24 * 7 },
  { key: "1mo", label: "1 month", hours: 24 * 30 },
  { key: "3mo", label: "3 months", hours: 24 * 90 },
  { key: "6mo", label: "6 months", hours: 24 * 180 },
  { key: "1y", label: "1 year", hours: 24 * 365 },
  { key: "2y", label: "2 years", hours: 24 * 730 },
];
const rangeHours = (k: RangeKey) => RANGE_OPTIONS.find((r) => r.key === k)?.hours ?? 24 * 730;

const SAFE_BASE_STYLE = {
  version: 8,
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-raster",
      type: "raster",
      source: "osm-raster",
      paint: {
        "raster-brightness-min": 0.08,
        "raster-brightness-max": 0.58,
        "raster-saturation": -0.65,
        "raster-contrast": 0.15,
      },
    },
  ],
} as const;

type SearchPoint = {
  lng: number;
  lat: number;
  label: string;
};

interface Props {
  center: [number, number];
  zoom?: number;
  searchedPoint?: SearchPoint | null;
}

export function StormSwathMap({ center, zoom = 4, searchedPoint = null }: Props) {
  const { data: token, error: tokenError } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const readyRef = useRef(false);
  const hailRef = useRef<FC>(EMPTY_FC);
  const windRef = useRef<FC>(EMPTY_FC);
  const terrRef = useRef<FC>(EMPTY_FC);
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const searchedPointRef = useRef<SearchPoint | null>(searchedPoint);
  const openPropertyPopupRef = useRef<((lng: number, lat: number, label?: string) => void) | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<RangeKey>("2y");
  const retryCountRef = useRef(0);
  const roRef = useRef<ResizeObserver | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initMapRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    centerRef.current = center;
    zoomRef.current = zoom;
  }, [center, zoom]);

  useEffect(() => {
    if (tokenError) toast.error(`Mapbox token: ${(tokenError as Error).message}`);
  }, [tokenError]);

  const { data: hailDates = [], isFetching: datesLoading } = useQuery({
    queryKey: ["storm-swath-dates"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("swath_dates" as any);
      if (error) {
        toast.error(`swath_dates: ${error.message}`);
        throw error;
      }
      const rows = (data ?? []) as any[];
      const list = rows
        .map((r) => (typeof r === "string" ? r : r?.event_date ?? r?.date))
        .filter(Boolean) as string[];
      return filterRecentDates(list, HAIL_DAYS);
    },
  });

  const { data: hail = EMPTY_FC, isFetching: hailLoading } = useQuery({
    queryKey: ["storm-swath-last-days", HAIL_DAYS, hailDates.join("|")],
    enabled: hailDates.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const featureGroups = await loadHailFeatureGroups(hailDates);
      return { type: "FeatureCollection", features: featureGroups.flat().filter(hasUsableGeometry) } as FC;
    },
  });

  const { data: wind = EMPTY_FC, isFetching: windLoading } = useQuery({
    queryKey: ["storm-wind", WIND_HOURS, "gte", WIND_MIN_MPH],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("wind_geojson" as any, { p_hours: WIND_HOURS });
      if (error) {
        toast.error(`wind_geojson: ${error.message}`);
        throw error;
      }
      return filterWindOverMph((data as FC) ?? EMPTY_FC, WIND_MIN_MPH);
    },
  });

  const { data: territories = EMPTY_FC, isFetching: terrLoading } = useQuery({
    queryKey: ["storm-territories"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("territories_geojson" as any);
      if (error) {
        toast.error(`territories_geojson: ${error.message}`);
        throw error;
      }
      return (data as FC) ?? EMPTY_FC;
    },
  });

  openPropertyPopupRef.current = (lng: number, lat: number, label?: string) => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat([lng, lat])
      .setHTML(buildPropertyPopupHtml(lng, lat, label, hailRef.current, windRef.current))
      .addTo(map);
  };

  const syncSearchMarker = (map: mapboxgl.Map | null = mapRef.current) => {
    markerRef.current?.remove();
    markerRef.current = null;
    const point = searchedPointRef.current;
    if (!map || !point) return;

    const marker = new mapboxgl.Marker({ color: "#3b82f6" })
      .setLngLat([point.lng, point.lat])
      .addTo(map);
    marker.getElement().setAttribute("aria-label", "Selected address");
    marker.getElement().addEventListener("click", (event) => {
      event.stopPropagation();
      openPropertyPopupRef.current?.(point.lng, point.lat, point.label);
    });
    markerRef.current = marker;
  };

  // Init map (self-healing)
  useEffect(() => {
    if (!token) return;
    const container = containerRef.current;
    if (!container) return;

    const destroyMap = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
      try { roRef.current?.disconnect(); } catch {}
      roRef.current = null;
      markerRef.current?.remove();
      markerRef.current = null;
      popupRef.current?.remove();
      popupRef.current = null;
      const m = mapRef.current;
      if (m) {
        try { m.remove(); } catch {}
      }
      mapRef.current = null;
      readyRef.current = false;
      setStyleReady(false);
    };

    const setupLayers = (map: mapboxgl.Map) => {
      if (readyRef.current) return;
      const addSrc = (id: string, cfg: any) => {
        if (!map.getSource(id)) map.addSource(id, cfg);
      };
      const addLyr = (cfg: any) => {
        if (!map.getLayer(cfg.id)) map.addLayer(cfg);
      };

      addSrc("territories", { type: "geojson", data: EMPTY_FC as any });
      addSrc("hail", { type: "geojson", data: EMPTY_FC as any });
      addSrc("wind-warnings", { type: "geojson", data: EMPTY_FC as any });
      addSrc("wind-lsr", {
        type: "geojson",
        data: EMPTY_FC as any,
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 50,
      });

      addLyr({
        id: "territories-line",
        type: "line",
        source: "territories",
        paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.85 },
      });
      addLyr({
        id: "hail-fill",
        type: "fill",
        source: "hail",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#FFD400"],
          "fill-opacity": 0.55,
        },
      });
      addLyr({
        id: "hail-outline",
        type: "line",
        source: "hail",
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#FFD400"],
          "line-width": 0.6,
          "line-opacity": 0.9,
        },
      });
      addLyr({
        id: "hail-bad-outline",
        type: "line",
        source: "hail",
        filter: [">=", ["coalesce", ["to-number", ["get", "max_in"]], 0], BAD_HAIL_IN],
        paint: {
          "line-color": "#ff2d55",
          "line-width": 2.5,
          "line-opacity": 0.95,
          "line-blur": 0.5,
        },
      });
      addLyr({
        id: "wind-warning-fill",
        type: "fill",
        source: "wind-warnings",
        paint: { "fill-color": "#2563eb", "fill-opacity": 0.12 },
      });
      addLyr({
        id: "wind-warning-line",
        type: "line",
        source: "wind-warnings",
        paint: {
          "line-color": "#2563eb",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
      });
      addLyr({
        id: "wind-lsr-clusters",
        type: "circle",
        source: "wind-lsr",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#3b82f6", 25,
            "#2563eb", 100,
            "#1d4ed8", 500,
            "#1e3a8a",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            14, 25,
            18, 100,
            24, 500,
            30,
          ],
          "circle-opacity": 0.85,
          "circle-stroke-color": "#0b1e4f",
          "circle-stroke-width": 1.5,
        },
      });
      addLyr({
        id: "wind-lsr-cluster-count",
        type: "circle",
        source: "wind-lsr",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": 0.01,
          "circle-opacity": 0,
        },
      });
      addLyr({
        id: "wind-lsr-points",
        type: "circle",
        source: "wind-lsr",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", "wind_mph"]], 40],
            30, 3,
            60, 6,
            90, 10,
            120, 14,
          ],
          "circle-color": "#2563eb",
          "circle-stroke-color": "#1e3a8a",
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      });
      addLyr({
        id: "wind-lsr-bad-halo",
        type: "circle",
        source: "wind-lsr",
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          [">=", ["coalesce", ["to-number", ["get", "wind_mph"]], 0], BAD_WIND_MPH],
        ],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", "wind_mph"]], 75],
            75, 12,
            100, 18,
            130, 26,
          ],
          "circle-color": "#ff2d55",
          "circle-opacity": 0.28,
          "circle-stroke-color": "#ff2d55",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.9,
        },
      });


      const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true });
      map.on("click", "hail-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties ?? {};
        const dateStr = p.event_date ?? "";
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px;line-height:1.4"><b>Hail band ${escapeHtml(p.band ?? "")}</b><br/>${escapeHtml(p.min_in ?? "?")}–${escapeHtml(p.max_in ?? "?")} in${dateStr ? `<br/><span style="opacity:0.7">${escapeHtml(dateStr)}</span>` : ""}</div>`,
          )
          .addTo(map);
      });
      map.on("click", "wind-lsr-points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties ?? {};
        const mph = p.wind_mph != null ? `${p.wind_mph} mph gust` : "Gust report";
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px;line-height:1.4"><b>${escapeHtml(mph)}</b>${p.event_time ? `<br/><span style="opacity:0.7">${escapeHtml(p.event_time)}</span>` : ""}<br/><span style="opacity:0.6">LSR</span></div>`,
          )
          .addTo(map);
      });
      map.on("click", "wind-lsr-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["wind-lsr-clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const src = map.getSource("wind-lsr") as any;
        if (clusterId == null || !src?.getClusterExpansionZoom) return;
        src.getClusterExpansionZoom(clusterId, (err: any, clusterZoom: number) => {
          if (err) return;
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: clusterZoom });
        });
      });
      map.on("click", "wind-warning-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties ?? {};
        const mphLine = p.wind_mph != null
          ? `${p.wind_mph} mph gust reported`
          : "Capable of 58+ mph winds";
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px;line-height:1.4"><b>Severe T-storm Warning</b><br/>${escapeHtml(mphLine)}${p.headline ? `<br/><span style="opacity:0.85">${escapeHtml(p.headline)}</span>` : ""}${p.event_time ? `<br/><span style="opacity:0.6">${escapeHtml(p.event_time)}</span>` : ""}</div>`,
          )
          .addTo(map);
      });
      map.on("click", (e) => {
        const clusterHits = map.queryRenderedFeatures(e.point, { layers: ["wind-lsr-clusters"] });
        if (clusterHits.length > 0) return;
        openPropertyPopupRef.current?.(e.lngLat.lng, e.lngLat.lat);
      });
      for (const layer of ["hail-fill", "wind-lsr-points", "wind-lsr-clusters", "wind-warning-fill"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      readyRef.current = true;
      (map.getSource("territories") as mapboxgl.GeoJSONSource | undefined)?.setData(terrRef.current as any);
      (map.getSource("hail") as mapboxgl.GeoJSONSource | undefined)?.setData(hailRef.current as any);
      applyWind(map, windRef.current);
      syncSearchMarker(map);
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
        try { map.resize(); } catch {}
      });
      ro.observe(c);
      roRef.current = ro;
      requestAnimationFrame(() => { try { map.resize(); } catch {} });

      map.on("error", (e: any) => {
        console.error("[StormMap] map error:", e?.error ?? e);
      });

      const markReady = () => {
        if (readyTimerRef.current) {
          clearTimeout(readyTimerRef.current);
          readyTimerRef.current = null;
        }
        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current);
          watchdogRef.current = null;
        }
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
          } catch (err) {
            console.error("[StormMap] readiness fallback failed:", err);
          }
        }, MAP_READY_TIMEOUT_MS);
      };

      watchdogRef.current = setTimeout(() => {
        if (readyRef.current) return;
        if (retryCountRef.current === 0) {
          console.warn("[StormMap] load watchdog timeout — retrying once");
          retryCountRef.current = 1;
          destroyMap();
          initMap();
        } else {
          console.error("[StormMap] load watchdog timeout — giving up");
          destroyMap();
          setInitError("Map failed to load");
        }
      }, 8000);

      const attachWebglRecovery = () => {
        const canvas = map.getCanvas();
        const onLost = (ev: Event) => {
          ev.preventDefault();
          console.warn("[StormMap] WebGL context lost — re-initializing");
          destroyMap();
          initMap();
        };
        canvas.addEventListener("webglcontextlost", onLost as any, { once: true });
        canvas.addEventListener("webglcontextrestored", () => {
          console.warn("[StormMap] WebGL context restored");
        });
      };

      map.once("style.load", markReady);
      map.once("load", markReady);
      map.once("idle", markReady);
      map.on("styledata", scheduleReadyFallback);
      attachWebglRecovery();

      requestAnimationFrame(() => {
        try {
          if (map.isStyleLoaded() || map.loaded()) markReady();
          else scheduleReadyFallback();
        } catch (err) {
          console.error("[StormMap] initial readiness check failed:", err);
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

  useEffect(() => {
    const filtered = filterHailByHours(hail, rangeHours(rangeKey));
    hailRef.current = filtered;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("hail") as mapboxgl.GeoJSONSource | undefined)?.setData(filtered as any);
  }, [hail, rangeKey]);

  useEffect(() => {
    const filtered = filterWindByHours(wind, rangeHours(rangeKey));
    windRef.current = filtered;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyWind(map, filtered);
  }, [wind, rangeKey]);

  useEffect(() => {
    terrRef.current = territories;
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("territories") as mapboxgl.GeoJSONSource | undefined)?.setData(territories as any);
  }, [territories]);

  useEffect(() => {
    searchedPointRef.current = searchedPoint;
    const map = mapRef.current;
    syncSearchMarker(map);
    if (!map || !searchedPoint) return;
    map.flyTo({ center: [searchedPoint.lng, searchedPoint.lat], zoom, essential: true });
  }, [searchedPoint, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || searchedPoint) return;
    map.flyTo({ center, zoom, essential: true });
  }, [center, zoom, searchedPoint]);

  const filteredHailCount = hailRef.current?.features?.length ?? 0;
  const filteredWindCount = windRef.current?.features?.length ?? 0;
  const badHailCount = (hailRef.current?.features ?? []).filter(
    (f: any) => Number(f?.properties?.max_in) >= BAD_HAIL_IN,
  ).length;
  const badWindCount = (windRef.current?.features ?? []).filter(
    (f: any) => Number(f?.properties?.wind_mph) >= BAD_WIND_MPH,
  ).length;
  const hasHail = filteredHailCount > 0;
  const windCount = filteredWindCount;
  const dataLoading = datesLoading || hailLoading || windLoading || terrLoading;
  const showOverlay = !token || !styleReady || dataLoading;
  const overlayLabel = !token
    ? "Authorizing map…"
    : !styleReady
      ? "Loading basemap…"
      : "Loading storm layers…";

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {initError ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ backgroundColor: "rgba(10,10,11,0.9)" }}
        >
          <div
            className="flex items-center gap-3 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "rgba(10,10,11,0.9)",
              color: "#f87171",
            }}
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
      ) : showOverlay && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          style={{ backgroundColor: !styleReady ? "rgba(10,10,11,0.85)" : "transparent" }}
        >
          <div
            className="pointer-events-none flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "rgba(10,10,11,0.9)",
              color: "var(--text-dim)",
            }}
          >
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--brand)" }} />
            {overlayLabel}
          </div>
        </div>
      )}
      <div
        className="pointer-events-none absolute bottom-4 left-4 rounded-lg border p-3 text-[11px] shadow-lg"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "rgba(10,10,11,0.85)",
          color: "var(--text-dim)",
          minWidth: 200,
        }}
      >
        <div className="mb-1 font-semibold text-foreground">Hail (in, 24h max MESH)</div>
        <div className="space-y-1">
          {[
            { c: "#FFD400", label: "0.75 – 1.00" },
            { c: "#FFA500", label: "1.00 – 1.50" },
            { c: "#FF4500", label: "1.50 – 2.00" },
            { c: "#D0021B", label: "2.00 – 3.00" },
            { c: "#7B1FA2", label: "3.00+" },
          ].map((r) => (
            <div key={r.c} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-6 rounded-sm"
                style={{ background: r.c, opacity: 0.7 }}
              />
              <span>{r.label}</span>
            </div>
          ))}
        </div>
        {!hasHail && (
          <div className="mt-2 italic" style={{ color: "var(--text-muted)" }}>
            No hail features in last {HAIL_DAYS} days
          </div>
        )}
        <div className="mt-3 mb-1 font-semibold text-foreground">Wind {WIND_MIN_MPH}+ MPH ({windCount})</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: "#2563eb", border: "1px solid #1e3a8a" }}
            />
            <span>LSR gust reports (clustered)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-6"
              style={{
                background: "rgba(37,99,235,0.12)",
                borderTop: "1.5px dashed #2563eb",
                borderBottom: "1.5px dashed #2563eb",
              }}
            />
            <span>Severe T-storm Warnings</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function applyWind(map: mapboxgl.Map, wind: FC) {
  const warnings: any[] = [];
  const lsr: any[] = [];
  for (const f of wind.features ?? []) {
    if (f?.properties?.source === "SVR_WARNING") warnings.push(f);
    else if (f?.properties?.source === "LSR") lsr.push(f);
    else {
      // Fallback: polygons → warnings, points → lsr
      const t = f?.geometry?.type;
      if (t === "Point" || t === "MultiPoint") lsr.push(f);
      else warnings.push(f);
    }
  }
  (map.getSource("wind-warnings") as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: warnings,
  } as any);
  (map.getSource("wind-lsr") as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: lsr,
  } as any);
}

function filterRecentDates(dates: string[], days: number) {
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return dates
    .filter((date) => {
      const parsed = parseDateOnly(date);
      return parsed ? parsed >= cutoff : false;
    })
    .sort()
    .reverse();
}

function filterWindOverMph(fc: FC, minMph: number): FC {
  return {
    type: "FeatureCollection",
    features: (fc.features ?? []).filter((feature) => {
      if (!hasUsableGeometry(feature)) return false;
      const mph = Number(feature?.properties?.wind_mph);
      return Number.isFinite(mph) && mph >= minMph;
    }),
  };
}

function featureTimestamp(feature: any): number | null {
  const p = feature?.properties ?? {};
  const raw = p.event_time ?? p.event_date ?? p.time ?? p.date ?? null;
  if (!raw) return null;
  const d = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00Z`)
    : new Date(raw);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function filterHailByHours(fc: FC, hours: number): FC {
  const cutoff = Date.now() - hours * 3600_000;
  return {
    type: "FeatureCollection",
    features: (fc.features ?? []).filter((f) => {
      const t = featureTimestamp(f);
      return t == null ? true : t >= cutoff;
    }),
  };
}

function filterWindByHours(fc: FC, hours: number): FC {
  const cutoff = Date.now() - hours * 3600_000;
  return {
    type: "FeatureCollection",
    features: (fc.features ?? []).filter((f) => {
      const t = featureTimestamp(f);
      return t == null ? true : t >= cutoff;
    }),
  };
}


async function loadHailFeatureGroups(hailDates: string[]) {
  const groups: any[][] = [];
  let failures = 0;

  for (let i = 0; i < hailDates.length; i += HAIL_LOAD_CONCURRENCY) {
    const batch = hailDates.slice(i, i + HAIL_LOAD_CONCURRENCY);
    const results = await Promise.all(batch.map(loadHailDateFeatures));
    for (const result of results) {
      if (result.ok) groups.push(result.features);
      else failures += 1;
    }
  }

  if (failures > 0) {
    toast.error(`Skipped ${failures} slow hail date${failures === 1 ? "" : "s"}`);
  }

  return groups;
}

async function loadHailDateFeatures(eventDate: string): Promise<{ ok: true; features: any[] } | { ok: false }> {
  try {
    const result = await withTimeout(
      stormSupabase.rpc("swath_geojson" as any, {
        p_event_date: eventDate,
        p_product: "MESH_Max_1440min",
      }),
      HAIL_DATE_TIMEOUT_MS,
    );
    const { data, error } = result as any;
    if (error) {
      console.error(`[StormMap] swath_geojson failed for ${eventDate}:`, error);
      return { ok: false };
    }
    const fc = (data as FC) ?? EMPTY_FC;
    return {
      ok: true,
      features: (fc.features ?? []).map((feature) => ({
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          event_date: feature.properties?.event_date ?? eventDate,
        },
      })),
    };
  } catch (err) {
    console.error(`[StormMap] swath_geojson timed out for ${eventDate}:`, err);
    return { ok: false };
  }
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    );
  });
}

function buildPropertyPopupHtml(lng: number, lat: number, label: string | undefined, hail: FC, wind: FC) {
  const hailHits = (hail.features ?? [])
    .filter((feature) => geometryContainsPoint(feature.geometry, lng, lat))
    .map((feature) => feature.properties ?? {})
    .sort((a, b) => String(b.event_date ?? "").localeCompare(String(a.event_date ?? "")));

  const windHits = (wind.features ?? [])
    .filter((feature) => windFeatureMatchesPoint(feature, lng, lat))
    .map((feature) => feature.properties ?? {})
    .sort((a, b) => String(b.event_time ?? b.event_date ?? "").localeCompare(String(a.event_time ?? a.event_date ?? "")))
    .slice(0, 12);

  const hailRows = hailHits.length > 0
    ? hailHits.slice(0, 12).map((p) => {
      const size = p.min_in != null && p.max_in != null
        ? `${p.min_in}–${p.max_in} in`
        : p.band ?? "Hail swath";
      return `<li><b>${escapeHtml(p.event_date ?? "Recent hail")}</b>: ${escapeHtml(size)}</li>`;
    }).join("")
    : `<li style="opacity:0.7">No hail swaths intersect this point in the last ${HAIL_DAYS} days.</li>`;

  const windRows = windHits.length > 0
    ? windHits.map((p) => {
      const time = p.event_time ?? p.event_date ?? "Recent wind";
      const headline = p.headline ? ` — ${p.headline}` : "";
      return `<li><b>${escapeHtml(p.wind_mph)} mph gust</b><br/><span style="opacity:0.72">${escapeHtml(time)}${escapeHtml(headline)}</span></li>`;
    }).join("")
    : `<li style="opacity:0.7">No ${WIND_MIN_MPH}+ MPH wind reports found within ${PROPERTY_WIND_RADIUS_MILES} mi.</li>`;

  const empty = hailHits.length === 0 && windHits.length === 0
    ? `<div style="margin-top:8px;border-top:1px solid rgba(148,163,184,0.25);padding-top:8px;color:#94a3b8">No matching hail or ${WIND_MIN_MPH}+ MPH wind found here.</div>`
    : "";

  return `
    <div style="font-family:system-ui;font-size:12px;line-height:1.4;max-width:290px">
      <b>${escapeHtml(label ?? "Selected location")}</b>
      <div style="opacity:0.62;margin-top:2px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
      <div style="margin-top:10px;font-weight:700">Hail — last ${HAIL_DAYS} days</div>
      <ul style="margin:4px 0 0 16px;padding:0">${hailRows}</ul>
      <div style="margin-top:10px;font-weight:700">Wind — last 2 years</div>
      <ul style="margin:4px 0 0 16px;padding:0">${windRows}</ul>
      ${empty}
    </div>
  `;
}

function windFeatureMatchesPoint(feature: any, lng: number, lat: number) {
  const geometry = feature?.geometry;
  if (!geometry) return false;
  if (geometry.type === "Point") {
    return haversineMiles(lng, lat, geometry.coordinates?.[0], geometry.coordinates?.[1]) <= PROPERTY_WIND_RADIUS_MILES;
  }
  if (geometry.type === "MultiPoint") {
    return (geometry.coordinates ?? []).some((coord: any) => haversineMiles(lng, lat, coord?.[0], coord?.[1]) <= PROPERTY_WIND_RADIUS_MILES);
  }
  return geometryContainsPoint(geometry, lng, lat);
}

function geometryContainsPoint(geometry: any, lng: number, lat: number): boolean {
  if (!geometry?.coordinates) return false;
  if (geometry.type === "Polygon") return polygonContainsPoint(geometry.coordinates, lng, lat);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon: any) => polygonContainsPoint(polygon, lng, lat));
  }
  return false;
}

function polygonContainsPoint(rings: any[], lng: number, lat: number) {
  if (!rings?.[0] || !ringContainsPoint(rings[0], lng, lat)) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (ringContainsPoint(rings[i], lng, lat)) return false;
  }
  return true;
}

function ringContainsPoint(ring: any[], lng: number, lat: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function haversineMiles(lng1: number, lat1: number, lng2: number, lat2: number) {
  if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return Infinity;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthMiles * Math.asin(Math.sqrt(a));
}

function parseDateOnly(date: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`)
    : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasUsableGeometry(feature: any) {
  return !!feature?.geometry?.type && feature.geometry.coordinates != null;
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}