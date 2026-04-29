import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import "mapbox-gl/dist/mapbox-gl.css";

export type AISegment = {
  index: number;
  name?: string;
  plan_area_sqft: number;
  pitch: string;
  pitch_degrees: number;
  ring: number[][]; // [lng,lat] pairs
  center?: { latitude: number; longitude: number } | null;
};

/** Renders a satellite Mapbox map with the AI-detected facets overlaid as colored polygons. */
export function AIMeasurementMap({
  lat,
  lng,
  segments,
  height = 320,
  interactive = false,
}: {
  lat: number;
  lng: number;
  segments: AISegment[];
  height?: number;
  interactive?: boolean;
}) {
  const { data: token } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [lng, lat],
      zoom: 19,
      interactive,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      const features: GeoJSON.Feature[] = segments
        .filter((s) => s.ring && s.ring.length >= 3)
        .map((s) => {
          const ring =
            s.ring[0][0] === s.ring[s.ring.length - 1][0] &&
            s.ring[0][1] === s.ring[s.ring.length - 1][1]
              ? s.ring
              : [...s.ring, s.ring[0]];
          const isFlat = (s.pitch_degrees ?? 0) < 5;
          return {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [ring] },
            properties: { kind: isFlat ? "flat" : "pitched" },
          } as GeoJSON.Feature;
        });

      map.addSource("ai-facets", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });
      map.addLayer({
        id: "ai-facets-fill",
        type: "fill",
        source: "ai-facets",
        paint: {
          "fill-color": [
            "match",
            ["get", "kind"],
            "flat",
            "#06b6d4",
            "#f59e0b",
          ],
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "ai-facets-line",
        type: "line",
        source: "ai-facets",
        paint: {
          "line-color": [
            "match",
            ["get", "kind"],
            "flat",
            "#0891b2",
            "#ea580c",
          ],
          "line-width": 2,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, lat, lng, segments, interactive]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-lg border"
      style={{ height, borderColor: "var(--border)" }}
    />
  );
}
