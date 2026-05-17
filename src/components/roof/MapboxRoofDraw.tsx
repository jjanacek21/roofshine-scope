import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { Feature, Polygon, LineString, Point, FeatureCollection } from "geojson";
import * as turf from "@turf/turf";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { LINE_COLORS, type EdgeType } from "@/lib/roof-math";
import { MAPBOX_DRAW_STYLES, type PenetrationType } from "@/lib/mapbox-draw-styles";
import { MeasurementPromptDialog, type PromptKind } from "./MeasurementPromptDialog";
import { DrawToolbar } from "./DrawToolbar";
import {
  computeTotals,
  nextSectionColor,
  type AnyFeature,
  type FeatureProps,
} from "@/lib/measurement-utils";
import { MeasurementTotalsPanel, type MeasurementTotals } from "./MeasurementTotalsPanel";
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
  lines: Array<{ id: string; coords: number[][]; type: EdgeType | null; is_perimeter?: boolean }>;
  // New richer shape
  features?: AnyFeature[];
  totals?: MeasurementTotals;
};

type Tool = "polygon" | "line" | "point" | "select";

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
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const [internalWaste, setInternalWaste] = useState(15);
  const waste = wastePct ?? internalWaste;
  const setWaste = onWasteChange ?? setInternalWaste;
  const [snapEnabled, setSnapEnabled] = useState(true);
  const snapEnabledRef = useRef(true);
  const shiftHeldRef = useRef(false);
  const inProgressIdRef = useRef<string | null>(null);
  const lastSnappedRef = useRef<[number, number] | null>(null);
  const snapPinRef = useRef<[number, number] | null>(null);
  snapEnabledRef.current = snapEnabled;
  const effectiveSnap = () => snapEnabledRef.current !== shiftHeldRef.current;

  // Label-edges mode: when active, clicking any line in simple_select applies
  // currentLabel to that line (or clears it when currentLabel is null = Erase).
  const [labelModeActive, setLabelModeActive] = useState(false);
  const [currentLabel, setCurrentLabel] = useState<EdgeType | null>(null);
  const labelModeRef = useRef(false);
  const currentLabelRef = useRef<EdgeType | null>(null);
  labelModeRef.current = labelModeActive;
  currentLabelRef.current = currentLabel;

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
        type: (f.properties?.edge_type ?? null) as EdgeType | null,
        is_perimeter: Boolean(f.properties?.is_perimeter),
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
      // Snap guide overlay: a single dashed segment from anchor to snapped cursor.
      map.addSource("snap-guide", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "snap-guide-line",
        type: "line",
        source: "snap-guide",
        paint: {
          "line-color": "#22d3ee",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
      });
    });

    const handleCreate = (e: { features: Feature[] }) => {
      const created = e.features[0];
      if (!created) return;
      if (created.geometry.type === "Polygon") {
        const sectionIdx = draw.getAll().features.filter((f) => f.geometry.type === "Polygon").length - 1;
        const sectionName = `Roof ${Math.max(1, sectionIdx + 1)}`;
        const sectionColor = nextSectionColor(Math.max(0, sectionIdx));
        const polygonId = String(created.id);
        draw.setFeatureProperty(polygonId, "pitch", "0/12");
        draw.setFeatureProperty(polygonId, "section_name", sectionName);
        draw.setFeatureProperty(polygonId, "section_color", sectionColor);
        draw.setFeatureProperty(polygonId, "section_waste_pct", waste);
        const ring = created.geometry.coordinates[0] ?? [];
        for (let i = 0; i < ring.length - 1; i++) {
          draw.add({
            type: "Feature",
            id: `${polygonId}-perim-${i}`,
            properties: {
              edge_type: "eave",
              user_color: LINE_COLORS.eave,
              is_perimeter: true,
              source_polygon_id: polygonId,
              source_segment_index: i,
            },
            geometry: { type: "LineString", coordinates: [ring[i], ring[i + 1]] },
          } as Feature<LineString, FeatureProps>);
        }
        syncFromDraw(draw);
        setTimeout(() => {
          if (drawRef.current) drawRef.current.changeMode("draw_line_string");
        }, 0);
      } else {
        // Lines & points: drop without prompting; user labels later.
        if (created.geometry.type === "LineString" && created.id != null) {
          draw.setFeatureProperty(String(created.id), "edge_type", null);
          draw.setFeatureProperty(String(created.id), "user_color", LINE_COLORS.unlabeled);
          draw.setFeatureProperty(String(created.id), "is_perimeter", false);
        }
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

      // Keep closed roof sections visibly highlighted while drawing detail lines.
      setPolyFillVisible(true);

      // Track which feature is currently in-progress so snap can mutate it.
      if (e.mode === "draw_polygon" || e.mode === "draw_line_string") {
        // Snapshot existing feature ids so captureInProgress can spot the new one.
        preExistingIds.clear();
        for (const f of draw.getAll().features) {
          if (f.id != null) preExistingIds.add(String(f.id));
        }
        inProgressIdRef.current = null;
      } else {
        inProgressIdRef.current = null;
        lastSnappedRef.current = null;
        const src = map.getSource("snap-guide") as mapboxgl.GeoJSONSource | undefined;
        src?.setData({ type: "FeatureCollection", features: [] });
      }
    });

    // ---- Snap-to-axis: compute snapped lngLat from anchor and update guide ----
    const clearSnapGuide = () => {
      const src = map.getSource("snap-guide") as mapboxgl.GeoJSONSource | undefined;
      src?.setData({ type: "FeatureCollection", features: [] });
      lastSnappedRef.current = null;
    };
    const computeSnap = (anchor: [number, number], cursor: [number, number]): [number, number] => {
      const a = map.project(anchor);
      const c = map.project(cursor);
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return cursor;
      const ang = Math.atan2(dy, dx);
      const step = Math.PI / 4; // 45°
      const snappedAng = Math.round(ang / step) * step;
      const sx = a.x + Math.cos(snappedAng) * dist;
      const sy = a.y + Math.sin(snappedAng) * dist;
      const ll = map.unproject([sx, sy]);
      return [ll.lng, ll.lat];
    };
    // Identify the in-progress feature by diffing feature ids around mode entry.
    const preExistingIds = new Set<string>();
    const captureInProgress = () => {
      if (inProgressIdRef.current) return;
      const mode = draw.getMode();
      if (mode !== "draw_polygon" && mode !== "draw_line_string") return;
      for (const f of draw.getAll().features) {
        const id = f.id != null ? String(f.id) : null;
        if (id && !preExistingIds.has(id)) {
          inProgressIdRef.current = id;
          return;
        }
      }
    };
    map.on("draw.render", captureInProgress);

    const getCoordsOf = (f: Feature): number[][] | null => {
      if (f.geometry.type === "Polygon") return f.geometry.coordinates[0] ?? null;
      if (f.geometry.type === "LineString") return f.geometry.coordinates ?? null;
      return null;
    };
    const setCoordsOn = (f: Feature, coords: number[][]): Feature => {
      if (f.geometry.type === "Polygon") {
        return { ...f, geometry: { ...f.geometry, coordinates: [coords] } } as Feature;
      }
      return { ...f, geometry: { ...f.geometry, coordinates: coords } } as Feature;
    };

    const getAnchor = (): [number, number] | null => {
      const id = inProgressIdRef.current;
      if (!id) return null;
      const f = draw.get(id);
      if (!f) return null;
      const coords = getCoordsOf(f);
      if (!coords || coords.length < 2) return null;
      // Last entry is the cursor-following hover slot; anchor is the prior one.
      // For a closed ring (first==last) the hover is at index length-2 and anchor at length-3.
      const last = coords[coords.length - 1];
      const first = coords[0];
      const closed =
        last && first && last[0] === first[0] && last[1] === first[1] && coords.length >= 3;
      const anchorIdx = closed ? coords.length - 3 : coords.length - 2;
      if (anchorIdx < 0) return null;
      const a = coords[anchorIdx];
      return [a[0], a[1]];
    };

    map.on("mousemove", (e: mapboxgl.MapMouseEvent) => {
      const mode = draw.getMode();
      if (mode !== "draw_polygon" && mode !== "draw_line_string") {
        if (lastSnappedRef.current) clearSnapGuide();
        return;
      }
      if (!effectiveSnap()) {
        if (lastSnappedRef.current) clearSnapGuide();
        return;
      }
      const anchor = getAnchor();
      if (!anchor) {
        if (lastSnappedRef.current) clearSnapGuide();
        return;
      }
      const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const snapped = computeSnap(anchor, cursor);
      lastSnappedRef.current = snapped;
      const src = map.getSource("snap-guide") as mapboxgl.GeoJSONSource | undefined;
      src?.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [anchor, snapped] },
          },
        ],
      });
    });

    // Snap the just-clicked vertex. Capture pre-click coord length on mousedown,
    // then after the click is processed, replace whichever index is new.
    let preClickLength = 0;

    // Find the nearest existing line/polygon vertex to a screen pixel position,
    // ignoring the currently in-progress feature. Used so endpoints of new
    // lines snap onto pins of already-drawn edges → shared corners stay
    // connected, which lets turf.polygonize close the perimeter into a ring.
    const findSnapPin = (px: number, py: number, tolPx = 14): [number, number] | null => {
      let best: [number, number] | null = null;
      let bestD = tolPx;
      const inProgId = inProgressIdRef.current;
      for (const f of draw.getAll().features) {
        if (inProgId && String(f.id) === inProgId) continue;
        let coords: number[][] = [];
        if (f.geometry.type === "LineString") coords = f.geometry.coordinates;
        else if (f.geometry.type === "Polygon") coords = f.geometry.coordinates[0] ?? [];
        else continue;
        for (const c of coords) {
          const p = map.project([c[0], c[1]] as [number, number]);
          const d = Math.hypot(p.x - px, p.y - py);
          if (d < bestD) {
            bestD = d;
            best = [c[0], c[1]];
          }
        }
      }
      return best;
    };

    const onCanvasMouseDown = (ev: MouseEvent) => {
      const mode = draw.getMode();

      // While drawing lines/polygons, check for a pin to snap to under the cursor.
      if (mode === "draw_line_string" || mode === "draw_polygon") {
        snapPinRef.current = findSnapPin(ev.offsetX, ev.offsetY);
      } else {
        snapPinRef.current = null;
      }

      preClickLength = 0;
      const id = inProgressIdRef.current;
      if (!id) return;
      const f = draw.get(id);
      if (!f) return;
      const coords = getCoordsOf(f);
      preClickLength = coords?.length ?? 0;
    };
    map.getCanvas().addEventListener("mousedown", onCanvasMouseDown, true);

    map.on("click", () => {
      const mode = draw.getMode();
      if (mode !== "draw_polygon" && mode !== "draw_line_string") return;
      // Pin snap takes precedence over axis snap.
      const snapped = snapPinRef.current ?? (effectiveSnap() ? lastSnappedRef.current : null);
      const preLen = preClickLength;
      const pinSnap = snapPinRef.current;
      // Consume so the same pin doesn't accidentally apply to the next click.
      snapPinRef.current = null;
      if (!snapped) return;
      // Defer so Draw finishes processing the click first.
      setTimeout(() => {
        const id = inProgressIdRef.current;
        if (!id) return;
        const f = draw.get(id);
        if (!f) return;
        const coords = getCoordsOf(f);
        if (!coords) return;
        // The newly-committed point is whichever slot Draw filled in with click coords.
        // Most commonly: pre [..., hover] (len N) → post [..., committed, hover] (len N+1),
        // and the new committed sits at index N-1 (replacing the prior hover slot).
        let targetIdx = preLen > 0 ? preLen - 1 : coords.length - 2;
        if (targetIdx < 0 || targetIdx >= coords.length) targetIdx = coords.length - 2;
        if (targetIdx < 0) return;
        const next = coords.slice();
        next[targetIdx] = snapped;
        // If the ring is closed (first==last), keep the closure in sync when we move index 0.
        if (
          f.geometry.type === "Polygon" &&
          targetIdx === 0 &&
          next.length >= 2 &&
          next[next.length - 1]?.[0] === coords[0]?.[0] &&
          next[next.length - 1]?.[1] === coords[0]?.[1]
        ) {
          next[next.length - 1] = snapped;
        }
        draw.add(setCoordsOn(f, next));
        // If we snapped to an existing pin, also finish the in-progress line so
        // the user can immediately start the next edge from a fresh click.
        if (pinSnap && f.geometry.type === "LineString" && next.length >= 2) {
          drawRef.current?.changeMode("draw_line_string");
        }
      }, 0);
    });

    // ---- Selection: polygons → direct_select; lines → label (or open prompt) ----
    map.on("draw.selectionchange", (e: { features: Feature[] }) => {
      const mode = draw.getMode();
      if (mode !== "simple_select") return;
      const selected = e.features?.[0];
      if (!selected?.id) return;
      // Label-edges mode: apply current label to the clicked line directly.
      if (labelModeRef.current && selected.geometry?.type === "LineString") {
        const lineId = String(selected.id);
        const label = currentLabelRef.current; // null = erase
        draw.setFeatureProperty(lineId, "edge_type", label);
        draw.setFeatureProperty(lineId, "user_color", label ? LINE_COLORS[label] : LINE_COLORS.unlabeled);
        // Deselect so the next line click registers as a fresh selection.
        setTimeout(() => {
          drawRef.current?.changeMode("simple_select");
          syncFromDrawRef.current?.(drawRef.current!);
        }, 0);
        return;
      }
      if (selected.geometry?.type === "Polygon") {
        setTimeout(() => {
          if (drawRef.current?.getMode() === "simple_select") {
            drawRef.current.changeMode("direct_select", { featureId: String(selected.id) });
          }
        }, 0);
      } else if (selected.geometry?.type === "LineString") {
        openLineLabelPromptRef.current?.(String(selected.id));
      } else if (selected.geometry?.type === "Point") {
        openPointLabelPromptRef.current?.(String(selected.id));
      }
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
        drawRef.current?.changeMode("simple_select");
        return;
      }
      if (ev.key === "Escape" && labelModeRef.current) {
        ev.preventDefault();
        setLabelModeActive(false);
        setCurrentLabel(null);
      }
    };
    const onShiftDown = (ev: KeyboardEvent) => {
      if (ev.key === "Shift") shiftHeldRef.current = true;
    };
    const onShiftUp = (ev: KeyboardEvent) => {
      if (ev.key === "Shift") shiftHeldRef.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keydown", onShiftDown);
    window.addEventListener("keyup", onShiftUp);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onShiftDown);
      window.removeEventListener("keyup", onShiftUp);
      map.getCanvas().removeEventListener("mousedown", onCanvasMouseDown, true);
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
  const syncFromDrawRef = useRef(syncFromDraw);
  syncFromDrawRef.current = syncFromDraw;

  // ---- Click-to-label handlers (all lines and points) ----
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
          draw.setFeatureProperty(featureId, "user_color", edge ? LINE_COLORS[edge] : LINE_COLORS.unlabeled);
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

  // Refs let the map's selectionchange handler reach these without recreating the map effect.
  const openLineLabelPromptRef = useRef(openLineLabelPrompt);
  const openPointLabelPromptRef = useRef(openPointLabelPrompt);
  openLineLabelPromptRef.current = openLineLabelPrompt;
  openPointLabelPromptRef.current = openPointLabelPrompt;

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

  // Collect unlabeled detail/perimeter lines.
  const KM_TO_FT = 3280.84;
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
          onChoose={(t) => {
            // Choosing a draw tool exits label mode.
            if (labelModeActive) {
              setLabelModeActive(false);
              setCurrentLabel(null);
            }
            chooseTool(t);
          }}
          onUndo={handleUndo}
          onClearAll={handleClearAll}
          snapEnabled={snapEnabled}
          onToggleSnap={() => setSnapEnabled((v) => !v)}
          labelMode={labelModeActive}
          currentLabel={currentLabel}
          onToggleLabelMode={() => {
            const next = !labelModeActive;
            setLabelModeActive(next);
            if (next) {
              // Enter label mode: stay in simple_select so line clicks register.
              setCurrentLabel((cur) => cur ?? "eave");
              drawRef.current?.changeMode("simple_select");
              setActiveTool("select");
            } else {
              setCurrentLabel(null);
            }
          }}
          onSelectLabel={(e) => setCurrentLabel(e)}
        />
        {labelModeActive && (
          <div
            className="pointer-events-none absolute inset-0 rounded-xl ring-2"
            style={{ boxShadow: "inset 0 0 0 2px var(--brand)" }}
          />
        )}
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
        unlabeledLines={unlabeledLines}
        onUnlabeledLineClick={(lineId) => openLineLabelPrompt(lineId)}
      />

      <MeasurementPromptDialog prompt={prompt} />
    </div>
  );
}
