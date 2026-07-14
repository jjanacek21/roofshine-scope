import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuery } from "@tanstack/react-query";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { supabase } from "@/integrations/supabase/client";

type FC = { type: "FeatureCollection"; features: any[] };

const EMPTY_FC: FC = { type: "FeatureCollection", features: [] };

interface Props {
  eventDate: string | null;
  windHours: number;
  center: [number, number];
  zoom?: number;
}

export function StormSwathMap({ eventDate, windHours, center, zoom = 9 }: Props) {
  const { data: token } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);

  const { data: hail = EMPTY_FC } = useQuery({
    queryKey: ["storm-swath", eventDate],
    enabled: !!eventDate,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("swath_geojson" as any, {
        p_event_date: eventDate,
        p_product: "MESH_Max_1440min",
      });
      if (error) throw error;
      return (data as FC) ?? EMPTY_FC;
    },
  });

  const { data: wind = EMPTY_FC } = useQuery({
    queryKey: ["storm-wind", windHours],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wind_geojson" as any, { p_hours: windHours });
      if (error) throw error;
      return (data as FC) ?? EMPTY_FC;
    },
  });

  const { data: territories = EMPTY_FC } = useQuery({
    queryKey: ["storm-territories"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("territories_geojson" as any);
      if (error) throw error;
      return (data as FC) ?? EMPTY_FC;
    },
  });

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-right");

    map.on("load", () => {
      map.addSource("territories", { type: "geojson", data: EMPTY_FC as any });
      map.addSource("hail", { type: "geojson", data: EMPTY_FC as any });
      map.addSource("wind", { type: "geojson", data: EMPTY_FC as any });

      map.addLayer({
        id: "territories-line",
        type: "line",
        source: "territories",
        paint: { "line-color": "#ffffff", "line-width": 1.2, "line-opacity": 0.6 },
      });

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

      map.addLayer({
        id: "wind-warning-fill",
        type: "fill",
        source: "wind",
        filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
        paint: { "fill-color": "#dc2626", "fill-opacity": 0.18 },
      });
      map.addLayer({
        id: "wind-warning-line",
        type: "line",
        source: "wind",
        filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
        paint: {
          "line-color": "#dc2626",
          "line-width": 1.4,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "wind-gust-points",
        type: "circle",
        source: "wind",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", "gust_mph"]], 40],
            30, 3,
            60, 6,
            90, 10,
            120, 14,
          ],
          "circle-color": "#f97316",
          "circle-stroke-color": "#7c2d12",
          "circle-stroke-width": 1,
          "circle-opacity": 0.9,
        },
      });

      // Popups
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
      map.on("click", "wind-gust-points", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties ?? {};
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px"><b>Gust ${p.gust_mph ?? "?"} mph</b><br/>${p.report_time ?? ""}<br/><span style="color:#666">${p.source ?? ""}</span></div>`,
          )
          .addTo(map);
      });
      map.on("click", "wind-warning-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p: any = f.properties ?? {};
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:system-ui;font-size:12px"><b>${p.event ?? "Wind warning"}</b><br/>${p.headline ?? ""}</div>`,
          )
          .addTo(map);
      });
      for (const layer of ["hail-fill", "wind-gust-points", "wind-warning-fill"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      readyRef.current = true;
      // Prime with current data
      (map.getSource("territories") as mapboxgl.GeoJSONSource | undefined)?.setData(territories as any);
      (map.getSource("hail") as mapboxgl.GeoJSONSource | undefined)?.setData(hail as any);
      (map.getSource("wind") as mapboxgl.GeoJSONSource | undefined)?.setData(wind as any);
    });

    mapRef.current = map;
    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Sync data updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("hail") as mapboxgl.GeoJSONSource | undefined)?.setData(hail as any);
  }, [hail]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("wind") as mapboxgl.GeoJSONSource | undefined)?.setData(wind as any);
  }, [wind]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("territories") as mapboxgl.GeoJSONSource | undefined)?.setData(territories as any);
  }, [territories]);

  // Fly to new market
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center, zoom, essential: true });
  }, [center[0], center[1], zoom]);

  const hasHail = (hail?.features?.length ?? 0) > 0;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {/* Legend */}
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
            { c: "#FF8C00", label: "1.00 – 1.50" },
            { c: "#E53935", label: "1.50 – 2.00" },
            { c: "#7B1FA2", label: "2.00+" },
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
        <div className="mt-3 mb-1 font-semibold text-foreground">Wind</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: "#f97316", border: "1px solid #7c2d12" }}
            />
            <span>Gust reports (mph)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-6"
              style={{
                background: "rgba(220,38,38,0.18)",
                borderTop: "1.5px dashed #dc2626",
                borderBottom: "1.5px dashed #dc2626",
              }}
            />
            <span>Warning areas</span>
          </div>
          <div className="italic" style={{ color: "var(--text-muted)" }}>
            Gust reports &amp; warning areas — not a swath
          </div>
        </div>
      </div>
    </div>
  );
}
