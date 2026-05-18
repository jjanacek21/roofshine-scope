import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { Feature, Polygon, LineString, Point, FeatureCollection } from "geojson";
import * as turf from "@turf/turf";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { EDGE_COLORS, type EdgeType } from "@/lib/roof-math";
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
  nextSectionColor,
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

type Tool = "polygon" | "line" | "point" | "select" | "label";

export function MapboxRoofDraw({
  center,
  initialFeatures,
  onChange,
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
  const activeToolRef = useRef<Tool | null>(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  const perimVerticesRef = useRef<[number, number][]>([]);
  const snapTargetRef = useRef<[number, number] | null>(null);
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const [internalWaste, setInternalWaste] = useState(15);
  const waste = wastePct ?? internalWaste;
  const setWaste = onWasteChange ?? setInternalWaste;

  // Push state up
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const totals = computeTotals(features, waste);
    const sections = features
      .filter((f): f is Feature<Polygon, FeatureProps> => f.geometry.type === "Polygon")
      .map((f, i) => {
        const ring = f.geometry.coordinates[0];
        return {
          id: String(f.id),
          name: f.properties?.section_name ?? `Roof ${i + 1}`,
          color: f.properties?.section_color ?? nextSectionColor(i),
          ring,
          plan_area_sqft: totals.sections[i]?.plan_area_sqft ?? 0,
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
  }, [features, waste]);

  const polygonCount = features.filter((f) => f.geometry.type === "Polygon").length;

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
      // Bigger hit targets so vertex pins are easier to grab.
      clickBuffer: 6,
      touchBuffer: 12,
    });
    drawRef.current = draw;
    map.addControl(draw);
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      if (initialFeatures && initialFeatures.length) {
        const fc: FeatureCollection = {
          type: "FeatureCollection",
          features: initialFeatures as unknown as Feature[],
        };
        draw.set(fc);
      }
      // Perimeter overlay: one feature per polygon segment, colored by label.
      map.addSource("perim-segs", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "perim-segs-hit",
        type: "line",
        source: "perim-segs",
        paint: { "line-color": "#000", "line-opacity": 0, "line-width": 18 },
      });
      map.addLayer({
        id: "perim-segs-line",
        type: "line",
        source: "perim-segs",
        layout: { "line-cap": "round" },
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#94a3b8"],
          "line-width": 5,
          "line-dasharray": [
            "case",
            ["==", ["get", "kind"], "unlabeled"],
            ["literal", [2, 2]],
            ["literal", [1, 0]],
          ],
          "line-opacity": 0.95,
        },
      });
      map.on("click", "perim-segs-hit", (ev) => {
        if (activeToolRef.current !== "label") return;
        const f = ev.features?.[0];
        if (!f) return;
        const polygonId = String(f.properties?.polygonId ?? "");
        const segIdx = Number(f.properties?.segIdx ?? -1);
        if (!polygonId || segIdx < 0) return;
        openPerimeterLabelPromptRef.current?.(polygonId, segIdx);
      });
      map.on("mouseenter", "perim-segs-hit", () => {
        if (activeToolRef.current === "label") map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "perim-segs-hit", () => {
        map.getCanvas().style.cursor = "";
      });

      // Perimeter vertex dots: visible always; the only valid snap targets while drawing lines.
      map.addSource("perim-vertices", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "perim-vertices-layer",
        type: "circle",
        source: "perim-vertices",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#0ea5e9",
          "circle-stroke-width": 2,
        },
      });

      // Snap preview halo (shown when cursor is near a perim vertex during line draw).
      map.addSource("snap-preview", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "snap-preview-layer",
        type: "circle",
        source: "snap-preview",
        paint: {
          "circle-radius": 10,
          "circle-color": "rgba(14,165,233,0.25)",
          "circle-stroke-color": "#0ea5e9",
          "circle-stroke-width": 2,
        },
      });
    });

    const handleCreate = (e: { features: Feature[] }) => {
      const created = e.features[0];
      if (!created) return;
      if (created.geometry.type === "Polygon") {
        // Polygons still prompt for pitch/name (needed for area math).
        promptForFeature(created, draw);
      } else {
        // Lines & points: drop without prompting; user labels later.
        syncFromDraw(draw);
        // Re-enter the same draw mode so user can keep adding shapes back-to-back.
        const stayMode: "draw_line_string" | "draw_point" =
          created.geometry.type === "LineString" ? "draw_line_string" : "draw_point";
        setTimeout(() => {
          if (drawRef.current) drawRef.current.changeMode(stayMode as never);
        }, 0);
      }
    };
    const handleUpdate = () => syncFromDraw(draw);
    const handleDelete = () => syncFromDraw(draw);

    map.on("draw.create", handleCreate);
    map.on("draw.update", handleUpdate);
    map.on("draw.delete", handleDelete);
    // Layer IDs whose hit-testing blocks vertex placement on top of an
    // existing polygon's blue fill while drawing lines or points.
    const POLY_FILL_LAYERS = [
      "gl-draw-polygon-fill-inactive.cold",
      "gl-draw-polygon-fill-inactive.hot",
      "gl-draw-polygon-fill-static.cold",
      "gl-draw-polygon-fill-static.hot",
    ];
    const setPolyFillVisible = (visible: boolean) => {
      for (const id of POLY_FILL_LAYERS) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
        }
      }
    };

    map.on("draw.modechange", (e: { mode: string }) => {
      if (e.mode === "simple_select") setActiveTool("select");
      else if (e.mode === "draw_polygon") setActiveTool("polygon");
      else if (e.mode === "draw_line_string") setActiveTool("line");
      else if (e.mode === "draw_point") setActiveTool("point");
      else if (e.mode === "direct_select") setActiveTool("select");

      // While drawing lines or points, hide existing polygon fills so clicks
      // pass through to the ground and Mapbox Draw drops vertices correctly.
      const drawingOverlay = e.mode === "draw_line_string" || e.mode === "draw_point";
      setPolyFillVisible(!drawingOverlay);
    });

    // ---- Selection: polygons → direct_select; lines/points → open label prompt ----
    map.on("draw.selectionchange", (e: { features: Feature[] }) => {
      const mode = draw.getMode();
      if (mode !== "simple_select") return;
      const selected = e.features?.[0];
      if (!selected?.id) return;
      if (selected.geometry?.type === "Polygon") {
        setTimeout(() => {
          if (drawRef.current?.getMode() === "simple_select") {
            drawRef.current.changeMode("direct_select", { featureId: String(selected.id) });
          }
        }, 0);
      } else if (selected.geometry?.type === "LineString") {
        if (activeToolRef.current === "label") {
          openLineLabelPromptRef.current?.(String(selected.id));
        }
      } else if (selected.geometry?.type === "Point") {
        if (activeToolRef.current === "label") {
          openPointLabelPromptRef.current?.(String(selected.id));
        }
      }
    });

    // ---- Vertex-only snapping while drawing interior lines ----
    map.on("mousemove", (e) => {
      if (drawRef.current?.getMode() !== "draw_line_string") {
        if (snapTargetRef.current) {
          snapTargetRef.current = null;
          const src = map.getSource("snap-preview") as mapboxgl.GeoJSONSource | undefined;
          src?.setData({ type: "FeatureCollection", features: [] });
        }
        return;
      }
      const verts = perimVerticesRef.current;
      if (!verts.length) return;
      const pt = e.point;
      let best: { v: [number, number]; d: number } | null = null;
      for (const v of verts) {
        const p = map.project(v as mapboxgl.LngLatLike);
        const d = Math.hypot(p.x - pt.x, p.y - pt.y);
        if (d < 14 && (!best || d < best.d)) best = { v, d };
      }
      snapTargetRef.current = best?.v ?? null;
      const src = map.getSource("snap-preview") as mapboxgl.GeoJSONSource | undefined;
      src?.setData({
        type: "FeatureCollection",
        features: best
          ? [{ type: "Feature", geometry: { type: "Point", coordinates: best.v }, properties: {} }]
          : [],
      });
    });

    map.on("click", () => {
      if (drawRef.current?.getMode() !== "draw_line_string") return;
      const snap = snapTargetRef.current;
      if (!snap) return;
      // After MapboxDraw drops its vertex, replace the most-recent vertex
      // with the exact snap coordinate.
      setTimeout(() => {
        const draw = drawRef.current;
        if (!draw) return;
        const selectedIds = (draw as unknown as { getSelectedIds: () => string[] })
          .getSelectedIds?.() ?? [];
        let lineId: string | undefined = selectedIds[0];
        if (!lineId) {
          const lines = draw.getAll().features.filter((f) => f.geometry.type === "LineString");
          lineId = lines[lines.length - 1]?.id as string | undefined;
        }
        if (!lineId) return;
        const f = draw.get(lineId);
        if (!f || f.geometry.type !== "LineString") return;
        const coords = (f.geometry as LineString).coordinates.slice();
        if (coords.length === 0) return;
        coords[coords.length - 1] = [snap[0], snap[1]];
        const updated: Feature = {
          ...f,
          geometry: { ...f.geometry, coordinates: coords },
        };
        draw.add(updated);
      }, 0);
    });

    // (Removed: mousedown click-intercept hack. We now hide existing polygon
    // fills while in draw_line_string / draw_point modes, so clicks pass
    // through naturally — see setPolyFillVisible above.)

    // ---- Enter-to-finish / Esc-to-cancel keybinds ----
    const onKey = (ev: KeyboardEvent) => {
      const mode = drawRef.current?.getMode();
      if (!mode) return;
      if (ev.key === "Enter" && (mode === "draw_polygon" || mode === "draw_line_string")) {
        ev.preventDefault();
        // Mapbox Draw commits the in-progress feature when leaving draw mode.
        drawRef.current?.changeMode("simple_select");
      }
      if (ev.key === "Escape" && (mode === "draw_polygon" || mode === "draw_line_string")) {
        ev.preventDefault();
        drawRef.current?.trash();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      
      window.removeEventListener("keydown", onKey);
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
        const idx = draw
          .getAll()
          .features.filter((f) => f.geometry.type === "Polygon")
          .findIndex((f) => f.id === feature.id);
        const sectionIdx = idx >= 0 ? idx : polygonCount;
        const defaultName = `Roof ${sectionIdx + 1}`;
        const color = nextSectionColor(sectionIdx);
        setPrompt({
          type: "pitch",
          defaultName,
          onConfirm: (result) => {
            if (feature.id != null) {
              const id = String(feature.id);
              draw.setFeatureProperty(id, "pitch", result.pitch);
              draw.setFeatureProperty(id, "section_name", result.name);
              draw.setFeatureProperty(id, "section_color", color);
              draw.setFeatureProperty(id, "section_waste_pct", waste);
            }
            setPrompt(null);
            cleanup();
          },
          onCancel: cancel,
        });
      }
    },
    [syncFromDraw, polygonCount, waste],
  );

  // ---- Click-to-label handlers (lines, points, perimeter segments) ----
  const openLineLabelPrompt = useCallback(
    (featureId: string) => {
      const draw = drawRef.current;
      if (!draw) return;
      const f = draw.get(featureId);
      const initial = (f?.properties?.edge_type ?? null) as EdgeType | null;
      setPrompt({
        type: "edge",
        title: "Label this line",
        initial,
        allowClear: true,
        onConfirm: (edge) => {
          draw.setFeatureProperty(featureId, "edge_type", edge);
          setPrompt(null);
          syncFromDraw(draw);
        },
        onCancel: () => setPrompt(null),
      });
    },
    [syncFromDraw],
  );

  const openPointLabelPrompt = useCallback(
    (featureId: string) => {
      const draw = drawRef.current;
      if (!draw) return;
      const f = draw.get(featureId);
      const initial = (f?.properties?.penetration_type ?? null) as PenetrationType | null;
      setPrompt({
        type: "penetration",
        initial,
        onConfirm: (penetration) => {
          draw.setFeatureProperty(featureId, "penetration_type", penetration);
          setPrompt(null);
          syncFromDraw(draw);
        },
        onCancel: () => setPrompt(null),
      });
    },
    [syncFromDraw],
  );

  const openPerimeterLabelPrompt = useCallback(
    (polygonId: string, segIdx: number) => {
      const draw = drawRef.current;
      if (!draw) return;
      const f = draw.get(polygonId);
      const ring = (f?.geometry as Polygon | undefined)?.coordinates?.[0] ?? [];
      const segCount = Math.max(0, ring.length - 1);
      const current = ((f?.properties?.perimeter_edges ?? []) as (EdgeType | null)[]).slice();
      while (current.length < segCount) current.push(null);
      setPrompt({
        type: "edge",
        title: `Perimeter edge #${segIdx + 1}`,
        initial: current[segIdx] ?? null,
        restrictTo: ["eave", "rake"],
        allowClear: true,
        onConfirm: (edge) => {
          current[segIdx] = edge;
          draw.setFeatureProperty(polygonId, "perimeter_edges", current);
          setPrompt(null);
          syncFromDraw(draw);
        },
        onCancel: () => setPrompt(null),
      });
    },
    [syncFromDraw],
  );

  // Refs let the map's selectionchange handler reach these without recreating the map effect.
  const openLineLabelPromptRef = useRef(openLineLabelPrompt);
  const openPointLabelPromptRef = useRef(openPointLabelPrompt);
  const openPerimeterLabelPromptRef = useRef(openPerimeterLabelPrompt);
  openLineLabelPromptRef.current = openLineLabelPrompt;
  openPointLabelPromptRef.current = openPointLabelPrompt;
  openPerimeterLabelPromptRef.current = openPerimeterLabelPrompt;

  // Keep the perimeter overlay source in sync with current polygon features.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("perim-segs") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const segFeatures: Feature[] = [];
    for (const f of features) {
      if (f.geometry.type !== "Polygon") continue;
      const polygonId = String(f.id ?? "");
      if (!polygonId) continue;
      const ring = f.geometry.coordinates[0];
      const labels = (f.properties?.perimeter_edges ?? []) as (EdgeType | null)[];
      for (let i = 0; i < ring.length - 1; i++) {
        const label = labels[i] ?? null;
        const color = label ? EDGE_COLORS[label] : "#94a3b8";
        segFeatures.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [ring[i], ring[i + 1]] },
          properties: { polygonId, segIdx: i, kind: label ?? "unlabeled", color },
        });
      }
    }
    src.setData({ type: "FeatureCollection", features: segFeatures });

    // Update perim-vertices source + ref (used for snapping).
    const verts: [number, number][] = [];
    for (const f of features) {
      if (f.geometry.type !== "Polygon") continue;
      const ring = f.geometry.coordinates[0];
      for (let i = 0; i < ring.length - 1; i++) {
        verts.push([ring[i][0], ring[i][1]]);
      }
    }
    perimVerticesRef.current = verts;
    const vsrc = map.getSource("perim-vertices") as mapboxgl.GeoJSONSource | undefined;
    vsrc?.setData({
      type: "FeatureCollection",
      features: verts.map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: v },
        properties: {},
      })),
    });
  }, [features]);

  // Toggle perimeter segment overlay: only active (clickable) in Label mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const vis = activeTool === "label" ? "visible" : "none";
    for (const id of ["perim-segs-hit", "perim-segs-line"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    }
  }, [activeTool]);

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

  const handleAddRoof = () => chooseTool("polygon");

  const handleSectionWasteChange = (sectionId: string, n: number) => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.setFeatureProperty(sectionId, "section_waste_pct", n);
    syncFromDraw(draw);
  };

  const handleSectionDelete = (sectionId: string) => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.delete(sectionId);
    syncFromDraw(draw);
  };

  const handleSectionRename = (sectionId: string, name: string) => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.setFeatureProperty(sectionId, "section_name", name);
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

  const totals = computeTotals(features, waste);

  // Build per-section perimeter segment lists + collect unlabeled lines.
  const KM_TO_FT = 3280.84;
  const perimeterBySection: Record<string, Array<{ idx: number; lf: number; label: EdgeType | null }>> = {};
  for (const f of features) {
    if (f.geometry.type !== "Polygon" || f.id == null) continue;
    const id = String(f.id);
    const ring = f.geometry.coordinates[0];
    const labels = (f.properties?.perimeter_edges ?? []) as (EdgeType | null)[];
    const segs: Array<{ idx: number; lf: number; label: EdgeType | null }> = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const lf = turf.length(turf.lineString([ring[i], ring[i + 1]]), { units: "kilometers" }) * KM_TO_FT;
      segs.push({ idx: i, lf, label: labels[i] ?? null });
    }
    perimeterBySection[id] = segs;
  }
  const unlabeledLines = features.flatMap((f) => {
    if (f.geometry.type !== "LineString" || f.id == null) return [];
    if (f.properties?.edge_type) return [];
    const lf = turf.length(f, { units: "kilometers" }) * KM_TO_FT;
    return [{ id: String(f.id), lf }];
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
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
        onAddRoof={handleAddRoof}
        onSectionWasteChange={handleSectionWasteChange}
        onSectionDelete={handleSectionDelete}
        onSectionRename={handleSectionRename}
        perimeterBySection={perimeterBySection}
        onPerimeterEdgeClick={(sectionId, segIdx) => {
          setActiveTool("label");
          openPerimeterLabelPrompt(sectionId, segIdx);
        }}
        unlabeledLines={unlabeledLines}
        onUnlabeledLineClick={(lineId) => {
          setActiveTool("label");
          openLineLabelPrompt(lineId);
        }}
      />

      <MeasurementPromptDialog prompt={prompt} />
    </div>
  );
}
