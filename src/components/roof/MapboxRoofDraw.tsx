import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { Feature, Polygon, LineString, Point, FeatureCollection } from "geojson";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { type EdgeType } from "@/lib/roof-math";
import {
  MAPBOX_DRAW_STYLES,
  type PenetrationType,
} from "@/lib/mapbox-draw-styles";
import {
  MeasurementPromptDialog,
  type PromptKind,
} from "./MeasurementPromptDialog";
import { DrawToolbar } from "./DrawToolbar";
import {
  computeTotals,
  type AnyFeature,
  type FeatureProps,
} from "@/lib/measurement-utils";
import {
  MeasurementTotalsPanel,
  type MeasurementTotals,
} from "./MeasurementTotalsPanel";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// Re-export types for external consumers
export type { AnyFeature };

export type MapboxRoofData = {
  // Backwards-compat shape (sections + lines)
  sections: Array<{
    id: string;
    name: string;
    color: string;
    ring: number[][];
    plan_area_sqft: number;
    pitch: string;
    edges: (EdgeType | null)[];
  }>;
  lines: Array<{ id: string; coords: number[][]; type: EdgeType }>;
  // New richer shape
  features?: AnyFeature[];
  totals?: MeasurementTotals;
};

type Tool = "polygon" | "line" | "point" | "select";

export function MapboxRoofDraw({
  center,
  initial,
  onChange,
  initialFeatures,
  onSave,
  isSaving,
  wastePct,
  onWasteChange,
}: {
  center: { lng: number; lat: number };
  initial?: MapboxRoofData;
  initialFeatures?: AnyFeature[];
  onChange: (data: MapboxRoofData) => void;
  onSave?: () => void;
  isSaving?: boolean;
  wastePct?: number;
  onWasteChange?: (n: number) => void;
}) {
  const { data: token, isLoading } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [features, setFeatures] = useState<AnyFeature[]>(initialFeatures ?? []);
  const [activeTool, setActiveTool] = useState<Tool | null>("select");
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const [internalWaste, setInternalWaste] = useState(15);
  const waste = wastePct ?? internalWaste;
  const setWaste = onWasteChange ?? setInternalWaste;

  // Push state up
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const totals = computeTotals(features);
    // Reconstruct legacy shape for backwards compat
    const sections = features
      .filter((f): f is Feature<Polygon, FeatureProps> => f.geometry.type === "Polygon")
      .map((f, i) => {
        const ring = f.geometry.coordinates[0];
        return {
          id: String(f.id),
          name: `Section ${i + 1}`,
          color: "#3b82f6",
          ring,
          plan_area_sqft: totals.total_area_sqft,
          pitch: f.properties?.pitch ?? "6/12",
          edges: ring.slice(0, -1).map(() => null as EdgeType | null),
        };
      });
    const linesArr = features
      .filter((f): f is Feature<LineString, FeatureProps> => f.geometry.type === "LineString")
      .map((f) => ({
        id: String(f.id),
        coords: f.geometry.coordinates,
        type: (f.properties?.edge_type ?? "ridge") as EdgeType,
      }));
    onChangeRef.current({ sections, lines: linesArr, features, totals });
  }, [features]);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [center.lng, center.lat],
      zoom: 20,
      maxZoom: 22,
      pitch: 0,
    });
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      defaultMode: "simple_select",
      styles: MAPBOX_DRAW_STYLES,
    });
    drawRef.current = draw;
    map.addControl(draw);
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Hydrate initial features
      if (initialFeatures && initialFeatures.length) {
        const fc: FeatureCollection = {
          type: "FeatureCollection",
          features: initialFeatures as unknown as Feature[],
        };
        draw.set(fc);
      }
    });

    const handleCreate = (e: { features: Feature[] }) => {
      const created = e.features[0];
      if (!created) return;
      promptForFeature(created, draw);
    };
    const handleUpdate = () => syncFromDraw(draw);
    const handleDelete = () => syncFromDraw(draw);

    map.on("draw.create", handleCreate);
    map.on("draw.update", handleUpdate);
    map.on("draw.delete", handleDelete);
    map.on("draw.modechange", (e: { mode: string }) => {
      if (e.mode === "simple_select") setActiveTool("select");
      else if (e.mode === "draw_polygon") setActiveTool("polygon");
      else if (e.mode === "draw_line_string") setActiveTool("line");
      else if (e.mode === "draw_point") setActiveTool("point");
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, center.lng, center.lat]);

  const syncFromDraw = useCallback((draw: MapboxDraw) => {
    const all = draw.getAll();
    setFeatures(all.features as unknown as AnyFeature[]);
  }, []);

  const promptForFeature = useCallback(
    (feature: Feature, draw: MapboxDraw) => {
      const cleanup = () => syncFromDraw(draw);
      const cancel = () => {
        if (feature.id != null) draw.delete(String(feature.id));
        setPrompt(null);
        cleanup();
      };

      if (feature.geometry.type === "Polygon") {
        setPrompt({
          type: "pitch",
          onConfirm: (pitch) => {
            if (feature.id != null) {
              draw.setFeatureProperty(String(feature.id), "pitch", pitch);
            }
            setPrompt(null);
            cleanup();
          },
          onCancel: cancel,
        });
      } else if (feature.geometry.type === "LineString") {
        setPrompt({
          type: "edge",
          onConfirm: (edge) => {
            if (feature.id != null) {
              draw.setFeatureProperty(String(feature.id), "edge_type", edge);
            }
            setPrompt(null);
            cleanup();
          },
          onCancel: cancel,
        });
      } else if (feature.geometry.type === "Point") {
        setPrompt({
          type: "penetration",
          onConfirm: (penetration: PenetrationType) => {
            if (feature.id != null) {
              draw.setFeatureProperty(String(feature.id), "penetration_type", penetration);
            }
            setPrompt(null);
            cleanup();
          },
          onCancel: cancel,
        });
      }
    },
    [syncFromDraw],
  );

  const chooseTool = (t: Tool) => {
    const draw = drawRef.current;
    if (!draw) return;
    setActiveTool(t);
    if (t === "polygon") draw.changeMode("draw_polygon");
    else if (t === "line") draw.changeMode("draw_line_string");
    else if (t === "point") draw.changeMode("draw_point");
    else draw.changeMode("simple_select");
  };

  const handleUndo = () => {
    const draw = drawRef.current;
    if (!draw) return;
    const all = draw.getAll();
    const last = all.features[all.features.length - 1];
    if (last?.id != null) {
      draw.delete(String(last.id));
      syncFromDraw(draw);
    }
  };

  const handleClearAll = () => {
    const draw = drawRef.current;
    if (!draw) return;
    if (!confirm("Clear all drawn shapes? This cannot be undone.")) return;
    draw.deleteAll();
    syncFromDraw(draw);
  };

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-xl bg-[var(--surface)]" />;
  }
  if (!token) {
    return (
      <div
        className="rounded-xl border p-6 text-sm text-muted-foreground"
        style={{ borderColor: "var(--border)" }}
      >
        Map unavailable. Mapbox token not configured.
      </div>
    );
  }

  const totals = computeTotals(features);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="relative">
        <div
          ref={containerRef}
          className="h-[600px] w-full overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--border)" }}
        />
        <DrawToolbar
          active={activeTool}
          onChoose={chooseTool}
          onUndo={handleUndo}
          onClearAll={handleClearAll}
        />
      </div>

      <MeasurementTotalsPanel
        totals={totals}
        wastePct={waste}
        onWasteChange={setWaste}
        onSave={onSave ?? (() => {})}
        isSaving={isSaving ?? false}
      />

      <MeasurementPromptDialog prompt={prompt} />
    </div>
  );
}
