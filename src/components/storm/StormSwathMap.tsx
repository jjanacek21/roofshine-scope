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

interface Props {
  eventDate: string | null;
  windHours: number;
  center: [number, number];
  zoom?: number;
}

export function StormSwathMap({ eventDate, windHours, center, zoom = 4 }: Props) {
  const { data: token, error: tokenError } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);
  const [styleReady, setStyleReady] = useState(false);

  useEffect(() => {
    if (tokenError) toast.error(`Mapbox token: ${(tokenError as Error).message}`);
  }, [tokenError]);

  const { data: hail = EMPTY_FC, isFetching: hailLoading } = useQuery({
    queryKey: ["storm-swath", eventDate],
    enabled: !!eventDate,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("swath_geojson" as any, {
        p_event_date: eventDate,
        p_product: "MESH_Max_1440min",
      });
      if (error) {
        toast.error(`swath_geojson: ${error.message}`);
        throw error;
      }
      return (data as FC) ?? EMPTY_FC;
    },
  });

  const { data: wind = EMPTY_FC } = useQuery({
    queryKey: ["storm-wind", windHours],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("wind_geojson" as any, { p_hours: windHours });
      if (error) {
        toast.error(`wind_geojson: ${error.message}`);
        throw error;
      }
      return (data as FC) ?? EMPTY_FC;
    },
  });

  const { data: territories = EMPTY_FC } = useQuery({
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

  // Init map
  useEffect(() => {
    if (!token) return;
    const container = containerRef.current;
    if (!container) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-right");

    // Resize once the container has laid out, and observe further size changes.
    const ro = new ResizeObserver(() => {
      try { map.resize(); } catch {}
    });
    ro.observe(container);
    const rafId = requestAnimationFrame(() => {
      try { map.resize(); } catch {}
    });

    map.on("load", () => {
      map.addSource("territories", { type: "geojson", data: EMPTY_FC as any });
      map.addSource("hail", { type: "geojson", data: EMPTY_FC as any });
      // Warning polygons: unclustered
      map.addSource("wind-warnings", { type: "geojson", data: EMPTY_FC as any });
      // LSR points: clustered
      map.addSource("wind-lsr", {
        type: "geojson",
        data: EMPTY_FC as any,
        cluster: true,
        clusterMaxZoom: 8,
        clusterRadius: 50,
      });

      // Territories: white 1.5px outlines
      map.addLayer({
        id: "territories-line",
        type: "line",
        source: "territories",
        paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.85 },
      });

      // Hail fill from feature color
      map.addLayer({
        id: "hail-fill",
        type: "fill",
        source: "hail",
        paint: {
          "fill-color": ["coalesce", ["get", "color"], "#FFD400"],
          "fill-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "hail-outline",
        type: "line",
        source: "hail",
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#FFD400"],
          "line-width": 0.6,
          "line-opacity": 0.9,
        },
      });

      // Warning polygons (unclustered)
      map.addLayer({
        id: "wind-warning-fill",
        type: "fill",
        source: "wind-warnings",
        paint: { "fill-color": "#2563eb", "fill-opacity": 0.12 },
      });
      map.addLayer({
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

      // Clustered LSR points
      map.addLayer({
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
      map.addLayer({
        id: "wind-lsr-cluster-count",
        type: "symbol",
        source: "wind-lsr",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
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

      const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true });
      map.on("click", "hail-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties ?? {};
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px"><b>Hail band ${p.band ?? ""}</b><br/>${p.min_in ?? "?"}–${p.max_in ?? "?"} in</div>`,
          )
          .addTo(map);
      });
      map.on("click", "wind-lsr-points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties ?? {};
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px"><b>Gust ${p.wind_mph ?? "?"} mph</b><br/>${p.event_time ?? ""}<br/><span style="color:#666">LSR</span></div>`,
          )
          .addTo(map);
      });
      map.on("click", "wind-lsr-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["wind-lsr-clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const src = map.getSource("wind-lsr") as any;
        if (clusterId == null || !src?.getClusterExpansionZoom) return;
        src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
      });
      map.on("click", "wind-warning-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties ?? {};
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px"><b>Severe T-storm Warning</b><br/>${p.headline ?? p.area ?? ""}</div>`,
          )
          .addTo(map);
      });
      for (const layer of ["hail-fill", "wind-lsr-points", "wind-lsr-clusters", "wind-warning-fill"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      readyRef.current = true;
      (map.getSource("territories") as mapboxgl.GeoJSONSource | undefined)?.setData(territories as any);
      (map.getSource("hail") as mapboxgl.GeoJSONSource | undefined)?.setData(hail as any);
      applyWind(map, wind);
    });

    return () => {
      readyRef.current = false;
      cancelAnimationFrame(rafId);
      try { ro.disconnect(); } catch {}
      try { map.remove(); } catch {}
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("hail") as mapboxgl.GeoJSONSource | undefined)?.setData(hail as any);
  }, [hail]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyWind(map, wind);
  }, [wind]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("territories") as mapboxgl.GeoJSONSource | undefined)?.setData(territories as any);
  }, [territories]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom, essential: true });
  }, [center[0], center[1], zoom]);

  const hasHail = (hail?.features?.length ?? 0) > 0;
  const windCount = wind?.features?.length ?? 0;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
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
        {!hasHail && eventDate && (
          <div className="mt-2 italic" style={{ color: "var(--text-muted)" }}>
            No hail features for {eventDate}
          </div>
        )}
        {!eventDate && (
          <div className="mt-2 italic" style={{ color: "var(--text-muted)" }}>
            No hail dates yet
          </div>
        )}
        <div className="mt-3 mb-1 font-semibold text-foreground">Wind ({windCount})</div>
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
