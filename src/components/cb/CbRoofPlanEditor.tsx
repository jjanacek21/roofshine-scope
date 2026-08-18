/**
 * Claim Buddy roof plan editor.
 * Satellite basemap + draggable roof geometry, built for one hand in a driveway:
 * 44px handles, a loupe under the finger, 15° snapping and forgiving hit areas.
 *
 * Persists into the tables this app already has — roof_sections / roof_edges /
 * roof_lines hanging off a roof_measurements row linked from cb_measurements.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { RotateCcw, Settings, Undo2 } from "lucide-react";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { CbButton, CbCard, CbChip, CbSheet } from "@/components/cb/primitives";
import { cbHaptic } from "@/components/cb/motion";
import {
  CB_EMPTY_PLAN,
  CB_EDGE_COLORS,
  CB_EDGE_LABELS,
  CB_EDGE_TYPES,
  PITCH_OPTIONS,
  autoClassifyEdges,
  cbSectionColor,
  closeRing,
  edgeCenter,
  lineLengthFeet,
  nearestPointOnRing,
  normalizeEdges,
  planTotals,
  ringCentroid,
  sectionActualAreaSqft,
  sectionEdgeLengths,
  snapVertex,
  type CbPlan,
  type CbPlanSection,
  type CbPlanTotals,
  type CbEdgeType,
} from "@/lib/cbRoofPlan";
import { confidenceColor, traceConfidence } from "@/lib/cbTraceConfidence";
import { regularizeRing, ringAxisDeg, snapVertexToAxis } from "@/lib/roof-regularize";
import "mapbox-gl/dist/mapbox-gl.css";

type Tool = "select" | "line" | "refine" | "label";

const uid = () => Math.random().toString(36).slice(2, 10);

/** Screen-space grab radius (px) for tap-to-refine. */
const TAP_VERTEX_PX = 34;
const TAP_EDGE_PX = 28;

export function CbRoofPlanEditor({
  plan,
  onPlanChange,
  center,
  readOnly = false,
  onReset,
  canReset,
  measurePins = [],
  pinDropMode = false,
  onPinDrop,
  onPinMove,
  onUndoPin,
  canUndoPin = false,
  onTogglePinDrop,
  onClearPins,
  onMeasure,
  measuring = false,
  aiPlan = null,
  onSaveFootprint,
  savingFootprint = false,
}: {
  plan: CbPlan;
  onPlanChange: (next: CbPlan, opts: { user: boolean }) => void;
  center: { lat: number; lng: number } | null;
  readOnly?: boolean;
  onReset?: () => void;
  canReset?: boolean;
  measurePins?: Array<{ lat: number; lng: number }>;
  pinDropMode?: boolean;
  onPinDrop?: (pin: { lat: number; lng: number }) => void;
  onPinMove?: (index: number, pin: { lat: number; lng: number }) => void;
  onUndoPin?: () => void;
  canUndoPin?: boolean;
  onTogglePinDrop?: () => void;
  onClearPins?: () => void;
  onMeasure?: () => void;
  measuring?: boolean;
  /** The untouched AI trace, drawn underneath as a dashed reference. */
  aiPlan?: CbPlan | null;
  onSaveFootprint?: (sectionId: string) => void;
  savingFootprint?: boolean;
}) {
  const { data: token } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  /** Bumped whenever the GL sources/layers are (re)created, so paint re-runs. */
  const [layersVersion, setLayersVersion] = useState(0);
  const layersDoneRef = useRef(false);
  /** Layers still not up after a grace period — offer a manual retry. */
  const [mapStuck, setMapStuck] = useState(false);
  const [mapVersion, setMapVersion] = useState(0);
  const centerRef = useRef(center);
  centerRef.current = center ?? centerRef.current;
  const [tick, setTick] = useState(0);

  const planRef = useRef(plan);
  planRef.current = plan;

  const [past, setPast] = useState<CbPlan[]>([]);
  const [future, setFuture] = useState<CbPlan[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [draft, setDraft] = useState<number[][]>([]);
  const [typeSheet, setTypeSheet] = useState<
    | { kind: "line"; coords: number[][] }
    | { kind: "lineEdit"; id: string }
    | { kind: "edge"; sectionId: string; index: number }
    | null
  >(null);
  /** AI trace overlay: dashed original outline + per-edge confidence colouring. */
  const [showTrace, setShowTrace] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pitchSheet, setPitchSheet] = useState<string | null>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);
  /** Corner currently being worked — used to thin out midpoint handles. */
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  /**
   * Buildings are square. On by default; turn it off for curved, octagonal or
   * bay-window roofs that genuinely are not rectilinear.
   */
  const [squareUp, setSquareUp] = useState(true);
  const [regNote, setRegNote] = useState<{ pct: number } | null>(null);
  /** Pre-regularization outlines, so "un-square" restores the raw trace. */
  const rawRingsRef = useRef<Record<string, number[][]>>({});

  const selected = plan.sections.find((s) => s.id === selectedId) ?? null;
  const activeSection = selected ?? plan.sections.find((section) => !section.isLocked) ?? plan.sections[0] ?? null;
  const locked = activeSection?.isLocked ?? false;
  const totals = useMemo(() => planTotals(plan), [plan]);

  /** Per-structure confidence in the AI trace, scored from the geometry itself. */
  const confidence = useMemo(() => {
    const byId = new Map<string, ReturnType<typeof traceConfidence>>();
    plan.sections.forEach((s, i) => {
      const aiRing =
        aiPlan?.sections.find((a) => a.id === s.id)?.ring ?? aiPlan?.sections[i]?.ring ?? null;
      byId.set(s.id, traceConfidence(s.ring, aiRing));
    });
    return byId;
  }, [plan.sections, aiPlan]);

  const overallConfidence = useMemo(() => {
    const all = [...confidence.values()];
    if (!all.length) return null;
    const percent = Math.round(all.reduce((n, c) => n + c.percent, 0) / all.length);
    return {
      percent,
      low: all.reduce((n, c) => n + c.lowCount, 0),
      label: percent >= 80 ? "High" : percent >= 60 ? "Medium" : "Low",
    };
  }, [confidence]);


  /* ------------------------------ history ------------------------------ */

  const commit = useCallback(
    (next: CbPlan) => {
      setPast((p) => [...p.slice(-40), planRef.current]);
      setFuture([]);
      onPlanChange(next, { user: true });
    },
    [onPlanChange],
  );

  const undo = () => {
    if (canUndoPin) {
      onUndoPin?.();
      cbHaptic(10);
      return;
    }
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [planRef.current, ...f]);
      onPlanChange(prev, { user: true });
      return p.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, planRef.current]);
      onPlanChange(f[0], { user: true });
      return f.slice(1);
    });
  };

  /* -------------------------------- map -------------------------------- */

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: centerRef.current
        ? [centerRef.current.lng, centerRef.current.lat]
        : [-98.5, 39.5],
      zoom: centerRef.current ? 19.5 : 3,
      pitch: 0,
      attributionControl: false,
      logoPosition: "bottom-right",
      preserveDrawingBuffer: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    /**
     * Idempotent, and deliberately NOT gated on `map.isStyleLoaded()`. On a
     * phone a stalled sprite or glyph request keeps that flag false for
     * minutes even though the style is perfectly usable, which left the roof
     * unhighlighted and the corner handles hidden. We just try to add the
     * layers: if the style really isn't parsed yet mapbox throws, we swallow
     * it and the next signal tries again.
     */
    const initLayers = () => {
      if (map.getLayer("cb-measure-pin-l")) {
        setReady(true);
        setMapStuck(false);
        // A previous pass may have died half way through: make sure the paint
        // effect runs at least once after the layers finally exist.
        if (!layersDoneRef.current) {
          layersDoneRef.current = true;
          setLayersVersion((v) => v + 1);
        }
        return;
      }
      try {
      const empty = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;
      const addSource = (id: string) => {
        if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty });
      };
      addSource("cb-fill");
      addSource("cb-ai");
      addSource("cb-conf");
      addSource("cb-edge");
      addSource("cb-line");
      addSource("cb-chip");
      addSource("cb-measure-pin");

      /*
       * Each layer add is independent. One throw used to abort the whole
       * function, leaving `cb-fill-l` present but the rest missing — and the
       * early return above then reported success forever, which is why the
       * roof highlight only appeared half the time.
       */
      const addLayer = (spec: mapboxgl.AnyLayer) => {
        try {
          if (!map.getLayer(spec.id)) map.addLayer(spec as never);
        } catch {
          /* retried on the next signal */
        }
      };

      addLayer({
        id: "cb-fill-l",
        type: "fill",
        source: "cb-fill",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["coalesce", ["get", "opacity"], 0.45],
        },
      });
      // Untouched AI outline, dashed cyan, sits under everything the rep draws.
      addLayer({
        id: "cb-ai-l",
        type: "line",
        source: "cb-ai",
        paint: {
          "line-color": "#22d3ee",
          "line-width": 2,
          "line-opacity": 0.9,
          "line-dasharray": [1.5, 1.5],
        },
      });
      // Detected edges tinted by how much we trust them.
      addLayer({
        id: "cb-conf-l",
        type: "line",
        source: "cb-conf",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 7,
          "line-opacity": 0.55,
          "line-blur": 1.5,
        },
      });
      addLayer({
        id: "cb-conf-pt",
        type: "circle",
        source: "cb-conf",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#0b1220",
          "circle-stroke-width": 1.5,
        },
      });
      // Solid bright outline around the counted area — a dashed hairline was
      // invisible against a shingle roof in sunlight.
      addLayer({
        id: "cb-fill-outline",
        type: "line",
        source: "cb-fill",
        paint: {
          "line-color": "#ffffff",
          "line-width": 3,
          "line-opacity": 0.95,
        },
      });

      addLayer({
        id: "cb-edge-l",
        type: "line",
        source: "cb-edge",
        paint: { "line-color": ["get", "color"], "line-width": 5, "line-opacity": 0.95 },
      });
      addLayer({
        id: "cb-edge-hit",
        type: "line",
        source: "cb-edge",
        paint: { "line-color": "#000", "line-opacity": 0.01, "line-width": 26 },
      });
      addLayer({
        id: "cb-line-l",
        type: "line",
        source: "cb-line",
        paint: { "line-color": ["get", "color"], "line-width": 5 },
      });
      addLayer({
        id: "cb-line-hit",
        type: "line",
        source: "cb-line",
        paint: { "line-color": "#000", "line-opacity": 0.01, "line-width": 26 },
      });
      addLayer({
        id: "cb-line-label",
        type: "symbol",
        source: "cb-line",
        layout: {
          "symbol-placement": "line-center",
          "text-field": ["get", "label"],
          "text-size": 13,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.6 },
      });
      addLayer({
        id: "cb-chip-l",
        type: "symbol",
        source: "cb-chip",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 13,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.8 },
      });
      addLayer({
        id: "cb-measure-pin-l",
        type: "circle",
        source: "cb-measure-pin",
        paint: {
          "circle-radius": 11,
          "circle-color": "#f97316",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 4,
        },
      });
      /*
       * Satellite-streets keeps road and label layers above anything added
       * later in some style revisions, which buried the roof fill. Re-assert
       * our own stack on top, in draw order, every time we (re)initialise.
       */
      [
        "cb-fill-l",
        "cb-fill-outline",
        "cb-ai-l",
        "cb-conf-l",
        "cb-conf-pt",
        "cb-edge-l",
        "cb-edge-hit",
        "cb-line-l",
        "cb-line-hit",
        "cb-line-label",
        "cb-chip-l",
        "cb-measure-pin-l",
      ].forEach((id) => {
        try {
          if (map.getLayer(id)) map.moveLayer(id);
        } catch {
          /* layer not ready yet */
        }
      });
      setReady(true);
      setMapStuck(false);
      layersDoneRef.current = true;
      // Re-run the paint effect: a style reload wipes source data.
      setLayersVersion((v) => v + 1);

      } catch {
        /* style not parsed yet — the next signal retries */
      }
    };

    map.on("load", initLayers);
    map.on("style.load", initLayers);
    map.on("styledata", initLayers);
    map.on("sourcedata", initLayers);
    map.on("idle", initLayers);
    initLayers();
    /*
     * Keep retrying for as long as the editor is mounted. The old 15s cutoff
     * meant a slow cellular style parse left the map permanently blank.
     */
    const retry = window.setInterval(initLayers, 700);
    const stuck = window.setTimeout(() => {
      if (!map.getLayer("cb-measure-pin-l")) setMapStuck(true);
    }, 8000);
    // Guard against a zero-height container at mount.
    const resize = window.setTimeout(() => map.resize(), 300);

    /*
     * Every camera change has to re-project the HTML handles, not just `move`:
     * a pinch-zoom, a rotate or a pitch left the corner dots sitting where the
     * roof used to be.
     */
    const repaint = () => setTick((t) => t + 1);
    (["move", "zoom", "rotate", "pitch", "moveend", "zoomend", "resize"] as const).forEach((ev) =>
      map.on(ev, repaint),
    );

    mapRef.current = map;
    setMapVersion((v) => v + 1);
    return () => {
      window.clearInterval(retry);
      window.clearTimeout(stuck);
      window.clearTimeout(resize);
      map.remove();
      mapRef.current = null;
    };
  }, [token]);


  // Recentre once coordinates arrive.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center || plan.sections.length) return;
    map.jumpTo({ center: [center.lng, center.lat], zoom: 19.5 });
  }, [center?.lat, center?.lng, plan.sections.length]);

  // Fit the first time geometry shows up.
  const fittedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || fittedRef.current || !plan.sections.length) return;
    const b = new mapboxgl.LngLatBounds();
    plan.sections.forEach((s) => s.ring.forEach((p) => b.extend(p as [number, number])));
    if (!b.isEmpty()) {
      map.fitBounds(b, { padding: 70, maxZoom: 20.5, duration: 0 });
      fittedRef.current = true;
    }
  }, [ready, plan.sections]);

  /* ---------------------------- render layers --------------------------- */

  useEffect(() => {
    const map = mapRef.current;
    // Not gated on `ready`: `set()` below no-ops until the sources exist, and
    // `layersVersion` re-runs this the moment they do.
    if (!map) return;

    const fills: GeoJSON.Feature[] = plan.sections.map((s) => ({
      type: "Feature",
      properties: {
        id: s.id,
        color: s.color,
        opacity: s.id === selectedId ? 0.6 : 0.45,
      },
      geometry: { type: "Polygon", coordinates: [closeRing(s.ring)] },
    }));

    const edges: GeoJSON.Feature[] = [];
    const chips: GeoJSON.Feature[] = [];
    plan.sections.forEach((s, si) => {
      const types = normalizeEdges(s.ring, s.edges);
      s.ring.forEach((p, i) => {
        const q = s.ring[(i + 1) % s.ring.length];
        edges.push({
          type: "Feature",
          properties: {
            sectionId: s.id,
            index: i,
            color: CB_EDGE_COLORS[types[i]] ?? "#ffffff",
          },
          geometry: { type: "LineString", coordinates: [p, q] },
        });
      });
      chips.push({
        type: "Feature",
        properties: {
          label: `${s.name || `Structure ${si + 1}`} · ${Math.round(
            sectionActualAreaSqft(s),
          ).toLocaleString()} sf · ${s.pitch}`,
          id: s.id,
        },
        geometry: { type: "Point", coordinates: ringCentroid(s.ring) },
      });
    });

    const lines: GeoJSON.Feature[] = plan.lines.map((l) => ({
      type: "Feature",
      properties: {
        id: l.id,
        color: CB_EDGE_COLORS[l.type],
        label: `${CB_EDGE_LABELS[l.type]} ${Math.round(lineLengthFeet(l.coords))} LF`,
      },
      geometry: { type: "LineString", coordinates: l.coords },
    }));
    /*
     * The in-progress line lives in the map layer too, one feature per segment
     * so each run carries its own length label. Drawing it in screen space made
     * it slide off the building during pan and zoom.
     */
    for (let i = 0; i < draft.length - 1; i++) {
      lines.push({
        type: "Feature",
        properties: {
          id: `draft-${i}`,
          color: "#ffffff",
          label: `${Math.round(lineLengthFeet([draft[i], draft[i + 1]]))} LF`,
        },
        geometry: { type: "LineString", coordinates: [draft[i], draft[i + 1]] },
      });
    }


    const set = (id: string, features: GeoJSON.Feature[]) =>
      (map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features,
      });
    // ---- AI trace overlay: dashed original + confidence-tinted edges ----
    const aiFeatures: GeoJSON.Feature[] = showTrace
      ? (aiPlan?.sections ?? [])
          .filter((s) => s.ring.length >= 3)
          .map((s) => ({
            type: "Feature",
            properties: { id: s.id },
            geometry: { type: "LineString", coordinates: closeRing(s.ring) },
          }))
      : [];

    const confFeatures: GeoJSON.Feature[] = [];
    if (showTrace) {
      plan.sections.forEach((s) => {
        const c = confidence.get(s.id);
        if (!c) return;
        c.edges.forEach((e) => {
          const a = s.ring[e.index];
          const b = s.ring[(e.index + 1) % s.ring.length];
          if (!a || !b) return;
          const color = confidenceColor(e.score);
          confFeatures.push({
            type: "Feature",
            properties: { color, score: e.score },
            geometry: { type: "LineString", coordinates: [a, b] },
          });
          confFeatures.push({
            type: "Feature",
            properties: { color },
            geometry: { type: "Point", coordinates: a },
          });
        });
      });
    }

    set("cb-fill", fills);
    set("cb-ai", aiFeatures);
    set("cb-conf", confFeatures);
    set("cb-edge", edges);
    set("cb-line", lines);
    set("cb-chip", chips);
    set(
      "cb-measure-pin",
      measurePins.map((pin, index) => ({
        type: "Feature",
        properties: { index: index + 1 },
        geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
      })),
    );
  }, [plan, layersVersion, selectedId, draft, measurePins, showTrace, aiPlan, confidence]);

  /* -------- pin markers: visible even when the GL layers never came up ----- */

  const pinMarkersRef = useRef<mapboxgl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pinMarkersRef.current.forEach((m) => m.remove());
    pinMarkersRef.current = [];
    if (ready) return; // the GL circle layer already draws them
    pinMarkersRef.current = measurePins.map((pin) => {
      const el = document.createElement("div");
      // pointer-events off: the draggable DOM handle above must get the press.
      el.style.cssText =
        "width:22px;height:22px;border-radius:999px;background:#f97316;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);pointer-events:none";
      return new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
    });
  }, [measurePins, ready, mapVersion]);

  /* --------------------------- tap to refine ---------------------------- */

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  /**
   * One-handed correction: tap near a corner to snap it onto the roof line you
   * tapped, tap on an edge to insert a new corner there. No dragging needed.
   */
  function refineTap(lngLat: [number, number], point: { x: number; y: number }) {
    const map = mapRef.current;
    const current = planRef.current;
    const section =
      current.sections.find((s) => s.id === selectedIdRef.current) ?? current.sections[0];
    if (!map || !section || section.ring.length < 3) return;

    const screen = section.ring.map((p) => map.project(p as [number, number]));

    let nearestV = -1;
    let bestV = Infinity;
    screen.forEach((p, i) => {
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < bestV) {
        bestV = d;
        nearestV = i;
      }
    });

    if (nearestV >= 0 && bestV <= TAP_VERTEX_PX) {
      const snapped = snapVertex(section.ring, nearestV, lngLat);
      commit(
        updateSection(section.id, (s) => ({
          ...s,
          ring: s.ring.map((p, i) => (i === nearestV ? snapped : p)),
        })),
      );
      cbHaptic(12);
      return;
    }

    // Distance from the tap to each edge segment, in screen pixels.
    let nearestE = -1;
    let bestE = Infinity;
    for (let i = 0; i < screen.length; i++) {
      const a = screen[i];
      const b = screen[(i + 1) % screen.length];
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * vx + (point.y - a.y) * vy) / len2));
      const d = Math.hypot(a.x + t * vx - point.x, a.y + t * vy - point.y);
      if (d < bestE) {
        bestE = d;
        nearestE = i;
      }
    }

    if (nearestE >= 0 && bestE <= TAP_EDGE_PX) {
      const edges = normalizeEdges(section.ring, section.edges);
      const ring = [...section.ring];
      ring.splice(nearestE + 1, 0, lngLat);
      const nextEdges = [...edges];
      nextEdges.splice(nearestE + 1, 0, edges[nearestE]);
      commit(updateSection(section.id, (s) => ({ ...s, ring, edges: nextEdges })));
      cbHaptic(12);
    }
  }

  function snapLinePoint(lngLat: [number, number], point: { x: number; y: number }) {
    const map = mapRef.current;
    if (!map) return lngLat;
    let best: [number, number] = lngLat;
    let bestDistance = TAP_EDGE_PX;
    for (const section of planRef.current.sections) {
      const candidate = nearestPointOnRing(section.ring, lngLat);
      const projected = map.project(candidate);
      const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
      for (const vertex of section.ring) {
        const projectedVertex = map.project(vertex as [number, number]);
        const vertexDistance = Math.hypot(projectedVertex.x - point.x, projectedVertex.y - point.y);
        if (vertexDistance < Math.min(bestDistance, TAP_VERTEX_PX)) {
          bestDistance = vertexDistance;
          best = [vertex[0], vertex[1]];
        }
      }
    }
    return best;
  }

  /* ------------------------------ map taps ------------------------------ */


  useEffect(() => {
    const map = mapRef.current;
    // Not gated on `ready`: a tap must place a pin even if the drawing layers
    // never came up.
    if (!map) return;

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      if (pinDropMode && !readOnly) {
        onPinDrop?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        cbHaptic(10);
        return;
      }
      if (tool === "line" && !readOnly) {
        setDraft((d) => [...d, snapLinePoint([e.lngLat.lng, e.lngLat.lat], e.point)]);
        cbHaptic(6);
        return;
      }
      if (tool === "refine" && !readOnly && !locked) {
        refineTap([e.lngLat.lng, e.lngLat.lat], e.point);
        return;
      }
      if (!map.getLayer("cb-fill-l")) return;
      const layers = ["cb-edge-hit", "cb-fill-l"];
      if (map.getLayer("cb-line-hit")) layers.unshift("cb-line-hit");
      const hits = map.queryRenderedFeatures(e.point, { layers });

      // A drawn line takes priority — that's what the rep is tapping to label.
      const lineHit = hits.find((f) => f.layer?.id === "cb-line-hit");
      if (lineHit && !readOnly) {
        const lineId = lineHit.properties?.id as string | undefined;
        if (lineId && !lineId.startsWith("draft")) {
          setTypeSheet({ kind: "lineEdit", id: lineId });
          return;
        }
      }

      const edgeHit = hits.find((f) => f.layer?.id === "cb-edge-hit");
      if (edgeHit && !readOnly && (locked || tool === "label")) {
        setSelectedId(edgeHit.properties?.sectionId as string);
        setTypeSheet({
          kind: "edge",
          sectionId: edgeHit.properties?.sectionId as string,
          index: Number(edgeHit.properties?.index ?? 0),
        });
        return;
      }
      const fillHit = hits.find((f) => f.layer?.id === "cb-fill-l");
      setSelectedId((fillHit?.properties?.id as string) ?? null);
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [mapVersion, ready, tool, readOnly, pinDropMode, locked, onPinDrop]);

  /* ------------------------------- loupe -------------------------------- */

  const paintLoupe = useCallback((clientX: number, clientY: number) => {
    const map = mapRef.current;
    const cv = loupeRef.current;
    const host = containerRef.current;
    if (!map || !cv || !host) return;
    const rect = host.getBoundingClientRect();
    const src = map.getCanvas();
    const scaleX = src.width / rect.width;
    const scaleY = src.height / rect.height;
    const zoom = 2.4;
    const size = 132;
    const srcW = (size / zoom) * scaleX;
    const srcH = (size / zoom) * scaleY;
    const sx = (clientX - rect.left) * scaleX - srcW / 2;
    const sy = (clientY - rect.top) * scaleY - srcH / 2;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    try {
      ctx.drawImage(src, sx, sy, srcW, srcH, 0, 0, size, size);
    } catch {
      /* canvas not readable yet */
    }
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size / 2 - 10, size / 2);
    ctx.lineTo(size / 2 + 10, size / 2);
    ctx.moveTo(size / 2, size / 2 - 10);
    ctx.lineTo(size / 2, size / 2 + 10);
    ctx.stroke();
  }, []);

  /**
   * A finger on a handle belongs to the handle, not to the map. Every camera
   * gesture is switched off for the whole press — doing this only once the
   * 250ms pickup fired let mapbox claim the touch first and reset the drag.
   */
  const lockMapGestures = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.dragPan.disable();
    map.dragRotate.disable();
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    map.touchPitch?.disable();
    map.boxZoom.disable();
  }, []);

  const unlockMapGestures = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.dragPan.enable();
    map.dragRotate.enable();
    map.scrollZoom.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    map.touchPitch?.enable();
    map.boxZoom.enable();
  }, []);

  /* ------------------------------ handles ------------------------------- */


  const project = (p: number[]) => {
    const map = mapRef.current;
    if (!map) return null;
    const pt = map.project(p as [number, number]);
    return { x: pt.x, y: pt.y };
  };

  const updateSection = (id: string, fn: (s: CbPlanSection) => CbPlanSection): CbPlan => ({
    ...planRef.current,
    sections: planRef.current.sections.map((s) => (s.id === id ? fn(s) : s)),
  });

  const dragRef = useRef<{
    start: CbPlan;
    moved: boolean;
    engaged: boolean;
    arm: number | null;
    hold: number | null;
    x: number;
    y: number;
  } | null>(null);

  /**
   * One finger, one corner. The gesture is owned by the handle from pointerdown
   * to pointerup: the pointer is captured (so leaving the 44px hit area cannot
   * drop the drag), the map's own drag-pan is switched off for the duration, and
   * a 250ms press with haptics is what picks the vertex up.
   */
  function beginVertexDrag(
    e: React.PointerEvent,
    sectionId: string,
    index: number,
    kind: "vertex" | "midpoint",
  ) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported — window listeners below still carry the drag */
    }
    cbHaptic(8);

    const map = mapRef.current;
    let vIndex = index;
    /* Grabbing a handle on a saved footprint re-opens it for editing. */
    const wasLocked =
      planRef.current.sections.find((x) => x.id === sectionId)?.isLocked ?? false;
    if (kind === "midpoint") {
      const s = planRef.current.sections.find((x) => x.id === sectionId);
      if (!s) return;
      const mid = edgeCenter(s.ring, index);
      const ring = [...s.ring];
      ring.splice(index + 1, 0, [mid[0], mid[1]]);
      const edges = normalizeEdges(s.ring, s.edges);
      const nextEdges = [...edges];
      nextEdges.splice(index + 1, 0, edges[index]);
      vIndex = index + 1;
      onPlanChange(
        updateSection(sectionId, (sec) => ({ ...sec, ring, edges: nextEdges, isLocked: false })),
        { user: true },
      );
    } else if (wasLocked) {
      onPlanChange(updateSection(sectionId, (sec) => ({ ...sec, isLocked: false })), {
        user: true,
      });
    }

    const axis = ringAxisDeg(
      planRef.current.sections.find((x) => x.id === sectionId)?.ring ?? [],
    );

    const engage = () => {
      const d = dragRef.current;
      if (!d || d.engaged) return;
      d.engaged = true;
      cbHaptic(16);
      setLoupe({ x: d.x, y: d.y });
      paintLoupe(d.x, d.y);
      // A stationary hold past the pickup still removes the corner.
      d.hold = window.setTimeout(() => {
        if (dragRef.current?.moved) return;
        deleteVertex(sectionId, vIndex);
        finish();
      }, 900);
    };

    dragRef.current = {
      start: planRef.current,
      moved: false,
      engaged: false,
      arm: kind === "midpoint" ? null : window.setTimeout(engage, 250),
      hold: null,
      x: e.clientX,
      y: e.clientY,
    };
    setSelectedId(sectionId);
    setSelectedVertex(vIndex);
    if (kind === "midpoint") engage();

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 8) {
        d.moved = true;
        if (d.hold) {
          clearTimeout(d.hold);
          d.hold = null;
        }
        // Deliberate movement is also a pickup — never make the rep wait.
        if (!d.engaged) {
          if (d.arm) clearTimeout(d.arm);
          d.arm = null;
          engage();
        }
      }
      if (!d.engaged) return;
      const m = mapRef.current;
      const host = containerRef.current;
      if (!m || !host) return;
      const rect = host.getBoundingClientRect();
      const ll = m.unproject([ev.clientX - rect.left, ev.clientY - rect.top]);
      const s = planRef.current.sections.find((x) => x.id === sectionId);
      if (!s) return;
      const raw: [number, number] = [ll.lng, ll.lat];
      const snapped = squareUp
        ? snapVertexToAxis(s.ring, vIndex, raw, axis)
        : snapVertex(s.ring, vIndex, raw);
      const ring = s.ring.map((p, i) => (i === vIndex ? snapped : p));
      onPlanChange(updateSection(sectionId, (sec) => ({ ...sec, ring, isLocked: false })), {
        user: true,
      });
      setLoupe({ x: ev.clientX, y: ev.clientY });
      requestAnimationFrame(() => paintLoupe(ev.clientX, ev.clientY));
    };

    function finish() {
      const d = dragRef.current;
      if (d) {
        if (d.arm) clearTimeout(d.arm);
        if (d.hold) clearTimeout(d.hold);
        if (d.engaged) cbHaptic(10);
        if (d.moved || kind === "midpoint") setPast((p) => [...p.slice(-40), d.start]);
      }
      dragRef.current = null;
      setLoupe(null);
      unlockMapGestures();
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  /**
   * Line points and measurement pins use the same tablet gesture as footprint
   * corners: a 250ms pickup (or deliberate movement), pointer capture, map-pan
   * suppression and the magnifier. This keeps an ordinary tap available for
   * adding or labelling a line.
   */
  function beginPointDrag(
    e: React.PointerEvent,
    target:
      | { kind: "draft"; index: number }
      | { kind: "line"; id: string; index: number }
      | { kind: "pin"; index: number },
  ) {
    if (readOnly || (target.kind === "pin" && !onPinMove)) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* window listeners still carry the drag */
    }

    const map = mapRef.current;
    const startPlan = planRef.current;
    const startDraft = draft.map((point) => [...point]);
    let moved = false;
    let engaged = false;
    const startX = e.clientX;
    const startY = e.clientY;

    const engage = () => {
      if (engaged) return;
      engaged = true;
      cbHaptic(16);
      setLoupe({ x: startX, y: startY });
      paintLoupe(startX, startY);
    };
    let arm: number | null = window.setTimeout(engage, 250);

    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        moved = true;
        if (!engaged) {
          if (arm) window.clearTimeout(arm);
          arm = null;
          engage();
        }
      }
      if (!engaged) return;
      const currentMap = mapRef.current;
      const host = containerRef.current;
      if (!currentMap || !host) return;
      const rect = host.getBoundingClientRect();
      const ll = currentMap.unproject([ev.clientX - rect.left, ev.clientY - rect.top]);
      const point = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      const raw: [number, number] = [ll.lng, ll.lat];
      const next = target.kind === "pin" ? raw : snapLinePoint(raw, point);

      if (target.kind === "draft") {
        setDraft((current) => current.map((p, index) => (index === target.index ? next : p)));
      } else if (target.kind === "line") {
        onPlanChange(
          {
            ...planRef.current,
            lines: planRef.current.lines.map((line) =>
              line.id === target.id
                ? { ...line, coords: line.coords.map((p, index) => (index === target.index ? next : p)) }
                : line,
            ),
          },
          { user: true },
        );
      } else {
        onPinMove?.(target.index, { lng: next[0], lat: next[1] });
      }
      setLoupe({ x: ev.clientX, y: ev.clientY });
      requestAnimationFrame(() => paintLoupe(ev.clientX, ev.clientY));
    };

    const finish = () => {
      if (arm) window.clearTimeout(arm);
      if (moved && target.kind === "line") setPast((history) => [...history.slice(-40), startPlan]);
      if (!moved && target.kind === "draft") setDraft(startDraft);
      if (engaged) cbHaptic(10);
      setLoupe(null);
      unlockMapGestures();
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function deleteVertex(sectionId: string, index: number) {
    const s = planRef.current.sections.find((x) => x.id === sectionId);
    if (!s || s.ring.length <= 3) return;
    cbHaptic(18);
    const ring = s.ring.filter((_, i) => i !== index);
    const edges = normalizeEdges(s.ring, s.edges).filter((_, i) => i !== index);
    commit(updateSection(sectionId, (sec) => ({ ...sec, ring, edges })));
  }

  /* ------------------------------ actions ------------------------------- */

  function removeSection(id: string) {
    commit({ ...plan, sections: plan.sections.filter((s) => s.id !== id) });
    setSelectedId(null);
  }

  function editSavedFootprint(id: string) {
    commit(updateSection(id, (section) => ({ ...section, isLocked: false })));
    setSelectedId(id);
    setTool("select");
  }

  function restoreActiveAiOutline() {
    if (!activeSection?.aiRing?.length) return;
    commit(updateSection(activeSection.id, (section) => ({
      ...section,
      ring: section.aiRing?.map((point) => [...point]) ?? section.ring,
      edges: (section.aiRing ?? section.ring).map(() => "unlabeled" as CbEdgeType),
    })));
    setSettingsOpen(false);
  }

  /**
   * Square the active outline onto the building's dominant axis, or put the raw
   * trace back. Area never changes silently: a move over 3% is flagged on screen
   * because that number feeds the estimate.
   */
  function toggleSquareUp() {
    const section = activeSection;
    if (!section) {
      setSquareUp((v) => !v);
      return;
    }
    if (squareUp && rawRingsRef.current[section.id]) {
      const raw = rawRingsRef.current[section.id];
      delete rawRingsRef.current[section.id];
      setSquareUp(false);
      setRegNote(null);
      commit(
        updateSection(section.id, (s) => ({
          ...s,
          ring: raw.map((p) => [...p]),
          edges: raw.map(() => "unlabeled" as CbEdgeType),
        })),
      );
      return;
    }
    if (squareUp) {
      // Nothing stored to revert to — just stop snapping future drags.
      setSquareUp(false);
      setRegNote(null);
      return;
    }
    const result = regularizeRing(section.ring);
    setSquareUp(true);
    if (result.ring.length < 3) return;
    rawRingsRef.current[section.id] = section.ring.map((p) => [...p]);
    setRegNote(result.flagged ? { pct: Math.round(result.areaDeltaPct * 10) / 10 } : null);
    commit(
      updateSection(section.id, (s) => ({
        ...s,
        ring: result.ring,
        edges: result.ring.map(() => "unlabeled" as CbEdgeType),
      })),
    );
  }

  function setPitch(id: string, pitch: string) {
    commit(updateSection(id, (s) => ({ ...s, pitch })));
    setPitchSheet(null);
  }

  /**
   * Draw first, label later. Every tapped point is a real endpoint: a draft
   * with 3+ points becomes one line PER SEGMENT so a ridge, hip and valley
   * drawn in one pass can each be labelled on their own.
   */
  function finishLine() {
    if (draft.length < 2) {
      setDraft([]);
      setTool("select");
      return;
    }
    const segments = draft.slice(0, -1).map((p, i) => ({
      id: uid(),
      coords: [p, draft[i + 1]],
      type: "unlabeled" as CbEdgeType,
    }));
    commit({ ...plan, lines: [...plan.lines, ...segments] });
    setDraft([]);
    cbHaptic();
  }


  function applyType(t: CbEdgeType) {
    if (!typeSheet) return;
    if (typeSheet.kind === "line") {
      commit({
        ...plan,
        lines: [...plan.lines, { id: uid(), coords: typeSheet.coords, type: t }],
      });
      setDraft([]);
      setTool("select");
    } else if (typeSheet.kind === "lineEdit") {
      const lineId = typeSheet.id;
      commit({
        ...plan,
        lines: plan.lines.map((l) => (l.id === lineId ? { ...l, type: t } : l)),
      });
    } else {
      const { sectionId, index } = typeSheet;
      commit(
        updateSection(sectionId, (s) => {
          const edges = normalizeEdges(s.ring, s.edges);
          edges[index] = t;
          return { ...s, edges: [...edges] };
        }),
      );
    }
    setTypeSheet(null);
    cbHaptic();
  }

  function deleteLine(id: string) {
    commit({ ...plan, lines: plan.lines.filter((l) => l.id !== id) });
  }

  /* ------------------------------- render ------------------------------- */

  const handleSection = activeSection;
  const vertexHandles: { x: number; y: number; index: number }[] = [];
  const midHandles: { x: number; y: number; index: number }[] = [];
  const draftHandles = tool === "line"
    ? draft.flatMap((point, index) => {
        const projected = project(point);
        return projected ? [{ ...projected, index }] : [];
      })
    : [];
  const lineHandles = tool !== "line"
    ? plan.lines.flatMap((line) =>
        line.coords.flatMap((point, index) => {
          const projected = project(point);
          return projected ? [{ ...projected, id: line.id, index }] : [];
        }),
      )
    : [];
  const pinHandles = measurePins.flatMap((pin, index) => {
    const projected = project([pin.lng, pin.lat]);
    return projected ? [{ ...projected, index }] : [];
  });
  if (handleSection && !readOnly && mapVersion > 0) {
    /*
     * Corners and blank edge dots stay on screen in every tool and even after
     * the footprint is saved — grabbing one re-opens it for editing. A midpoint
     * is skipped only when it would land on top of one of its own corners.
     */
    handleSection.ring.forEach((p, i) => {
      const pt = project(p);
      if (pt) vertexHandles.push({ ...pt, index: i });
      const m = project(edgeCenter(handleSection.ring, i));
      const next = project(handleSection.ring[(i + 1) % handleSection.ring.length]);
      if (!m) return;
      const tooTight =
        (pt && Math.hypot(m.x - pt.x, m.y - pt.y) < 18) ||
        (next && Math.hypot(m.x - next.x, m.y - next.y) < 18);
      if (tooTight) return;
      midHandles.push({ ...m, index: i });
    });
  }

  return (
    <div className="space-y-3">
      <CbCard className="overflow-hidden p-0">
        <div className="relative">
          <div
            ref={containerRef}
            className="h-[420px] w-full"
            style={{ touchAction: "none" }}
            aria-label="Roof plan editor"
          />

          {/* vertex + midpoint handles */}
          {/*
            No `key` churn here: re-keying on every map move remounted the
            handles mid-gesture, which destroyed the element holding the pointer
            capture and reset the drag. Positions re-render, the nodes persist.
          */}
          <div className="pointer-events-none absolute inset-0" data-tick={tick}>
            {pinHandles.map((h) => (
              <DragPointHandle
                key={`pin-${h.index}`}
                x={h.x}
                y={h.y}
                label={`Measurement pin ${h.index + 1} — press and hold to move`}
                color="var(--cb-accent)"
                size={18}
                onPointerDown={(e) => beginPointDrag(e, { kind: "pin", index: h.index })}
              />
            ))}
            {lineHandles.map((h) => (
              <DragPointHandle
                key={`line-${h.id}-${h.index}`}
                x={h.x}
                y={h.y}
                label="Line endpoint — press and hold to move"
                color="var(--cb-text)"
                size={12}
                onPointerDown={(e) => beginPointDrag(e, { kind: "line", id: h.id, index: h.index })}
              />
            ))}
            {draftHandles.map((h) => (
              <DragPointHandle
                key={`draft-${h.index}`}
                x={h.x}
                y={h.y}
                label="Line point — press and hold to move"
                color="var(--cb-text)"
                size={14}
                onPointerDown={(e) => beginPointDrag(e, { kind: "draft", index: h.index })}
              />
            ))}
            {midHandles.map((h) => (
              <button
                key={`m${h.index}`}
                type="button"
                aria-label={`Insert point on edge ${h.index + 1}`}
                onPointerDown={(e) =>
                  handleSection && beginVertexDrag(e, handleSection.id, h.index, "midpoint")
                }
                className="pointer-events-auto absolute grid place-items-center"
                style={{
                  left: h.x - 22,
                  top: h.y - 22,
                  width: 44,
                  height: 44,
                  background: "transparent",
                  border: 0,
                  touchAction: "none",
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    border: "2px solid rgba(255,255,255,0.9)",
                    background: "rgba(0,0,0,0.35)",
                  }}
                />
              </button>
            ))}
            {vertexHandles.map((h) => (
              <button
                key={`v${h.index}`}
                type="button"
                aria-label={`Corner ${h.index + 1} — drag to move, hold to delete`}
                onPointerDown={(e) =>
                  handleSection && beginVertexDrag(e, handleSection.id, h.index, "vertex")
                }
                className="pointer-events-auto absolute grid place-items-center"
                style={{
                  left: h.x - 22,
                  top: h.y - 22,
                  width: 44,
                  height: 44,
                  background: "transparent",
                  border: 0,
                  touchAction: "none",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: "#fff",
                    border: `3px solid ${handleSection?.color ?? "#f97316"}`,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
                  }}
                />
              </button>
            ))}
          </div>

          {/* loupe */}
          {loupe ? (
            <canvas
              ref={loupeRef}
              width={132}
              height={132}
              className="pointer-events-none absolute"
              style={{
                left: Math.max(8, loupe.x - (containerRef.current?.getBoundingClientRect().left ?? 0) - 66),
                top: Math.max(
                  8,
                  loupe.y - (containerRef.current?.getBoundingClientRect().top ?? 0) - 170,
                ),
                width: 132,
                height: 132,
                borderRadius: 999,
                border: "3px solid rgba(255,255,255,0.9)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}
            />
          ) : null}

          {/*
            The draft line itself is drawn by the `cb-line` map layer (real
            lat/long) so it stays on the roof through pan, zoom and rotate. Only
            its draggable points remain as HTML, above.
          */}


          {/* toolbar */}

          {!readOnly ? (
            <div className="absolute left-3 top-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
              <span className="min-w-0 truncate rounded-[10px] px-3 py-2 text-[13px] font-semibold" style={{ background: "rgba(12,16,22,0.78)", color: "#fff" }}>
                {activeSection?.name ?? "Drop a roof pin"}
              </span>
              <MapIconBtn label={canUndoPin ? "Undo pin drop" : "Undo"} onClick={undo} disabled={!past.length && !canUndoPin}><Undo2 size={18} /></MapIconBtn>
              <MapIconBtn label="Measurement settings" onClick={() => setSettingsOpen(true)}><Settings size={18} /></MapIconBtn>
            </div>
          ) : (
            <div className="absolute left-3 top-3">
              <CbChip>Read only — report generated</CbChip>
            </div>
          )}

          {regNote ? (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="absolute left-3 right-3 top-16 rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold"
              style={{ background: "rgba(180,83,9,0.92)", color: "#fff" }}
            >
              Squaring changed the area by {regNote.pct > 0 ? "+" : ""}
              {regNote.pct}% — check the outline before you price it.
            </button>
          ) : null}


          {tool === "line" && !readOnly ? (
            /*
              Sits well clear of the Mapbox logo strip in the bottom-right —
              tapping "Undo point" used to open mapbox.com instead.
            */
            <div
              className="pointer-events-auto absolute bottom-20 left-3 right-3 z-40 flex flex-wrap items-center gap-2 rounded-[10px] p-2"
              style={{ background: "var(--cb-surface)" }}
            >

              <MapBtn onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length}>
                Undo point
              </MapBtn>
              <MapBtn onClick={finishLine} disabled={draft.length < 2}>
                Finish line ({Math.round(lineLengthFeet(draft))} LF)
              </MapBtn>
              <MapBtn
                onClick={() => {
                  setDraft([]);
                  setTool("select");
                }}
              >
                Done drawing
              </MapBtn>
            </div>
          ) : null}

          {!readOnly ? (
            <div className="pointer-events-none absolute bottom-10 left-3 right-3 z-10 flex justify-center">
              {tool !== "line" ? (
                <span
                  className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
                  style={{ background: "rgba(12,16,22,0.78)", color: "#fff" }}
                >
                  {pinDropMode
                    ? "Tap the roof to drop a measurement pin"
                    : tool === "refine"
                      ? "Tap a red edge to add a corner, or tap near a corner to snap it"
                      : locked
                        ? "Tap Label lines, then tap each line or perimeter edge"
                        : plan.sections.length
                          ? "Drag the corners onto the roof, then Save roof footprint"
                          : "Drop a pin and measure to trace the roof"}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Always-visible measure action — never hunt for it down the page. */}
        {!readOnly ? (
          <div className="border-t px-4 py-3" style={{ borderColor: "var(--cb-border)" }}>
            {activeSection && !activeSection.isLocked ? (
              <CbButton block onClick={() => onSaveFootprint?.(activeSection.id)} loading={savingFootprint} loadingText="Saving footprint…">
                Save this footprint
              </CbButton>
            ) : measurePins.length > plan.sections.length && onMeasure ? (
              <CbButton block onClick={onMeasure} loading={measuring} loadingText="Measuring…">Measure roof</CbButton>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <CbButton block variant="secondary" onClick={onTogglePinDrop}>{pinDropMode ? "Tap roof to place pin" : "Add another roof"}</CbButton>
                <CbButton block onClick={() => { setTool("line"); setDraft([]); }}>Continue to lines</CbButton>
              </div>
            )}
            {!ready ? (
              mapStuck ? (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                    Map overlay didn’t come up.
                  </p>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1 text-[12px] font-semibold"
                    style={{ background: "var(--cb-surface-2, rgba(0,0,0,.06))" }}
                    onClick={() => {
                      setMapStuck(false);
                      const map = mapRef.current;
                      if (!map) return;
                      map.resize();
                      try {
                        map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
                      } catch {
                        /* noop */
                      }
                    }}
                  >
                    Retry map
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                  Map is still loading — any measurements listed below are still valid.
                </p>
              )
            ) : null}
          </div>
        ) : null}
      </CbCard>



      {/* structures */}
      <div className="space-y-2">
        {plan.sections.map((s, i) => {
          const types = normalizeEdges(s.ring, s.edges);
          const lens = sectionEdgeLengths(s);
          return (
            <CbCard key={s.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className="flex items-center gap-2 text-left"
                >
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: s.color,
                      display: "inline-block",
                    }}
                  />
                  <span className="text-[16px] font-semibold">{s.name || `Structure ${i + 1}`}</span>
                  {s.isLocked ? <CbChip>Saved</CbChip> : null}
                </button>
                <span className="cb-num text-[15px] font-semibold">
                  {Math.round(sectionActualAreaSqft(s)).toLocaleString()} sf
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <MapBtn onClick={() => setPitchSheet(s.id)} disabled={readOnly}>
                  Pitch {s.pitch}
                </MapBtn>
                <MapBtn onClick={() => s.isLocked ? editSavedFootprint(s.id) : setSelectedId(s.id)}>{s.isLocked ? "Edit footprint" : selectedId === s.id ? "Editing" : "Edit shape"}</MapBtn>
                {plan.sections.length > 1 && !readOnly ? (
                  <MapBtn onClick={() => removeSection(s.id)}>Remove</MapBtn>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {types.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setTypeSheet({ kind: "edge", sectionId: s.id, index: idx })}
                    className="cb-num rounded-full px-2.5 py-1 text-[12px] font-semibold"
                    style={{
                      background: `${CB_EDGE_COLORS[t]}22`,
                      color: CB_EDGE_COLORS[t],
                      border: `1px solid ${CB_EDGE_COLORS[t]}66`,
                    }}
                  >
                    {CB_EDGE_LABELS[t]} {Math.round(lens[idx] ?? 0)}
                  </button>
                ))}
              </div>
            </CbCard>
          );
        })}

        {plan.lines.length ? (
          <CbCard className="p-4">
            <p className="text-[12px] uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
              Drawn lines
            </p>
            <div className="mt-2 space-y-2">
              {plan.lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setTypeSheet({ kind: "lineEdit", id: l.id })}
                    className="rounded-full px-2.5 py-1 text-[14px] font-semibold"
                    style={{
                      background: `${CB_EDGE_COLORS[l.type]}22`,
                      color: CB_EDGE_COLORS[l.type],
                      border: `1px solid ${CB_EDGE_COLORS[l.type]}66`,
                    }}
                  >
                    {CB_EDGE_LABELS[l.type]}
                  </button>
                  <span className="cb-num text-[14px] font-semibold">
                    {Math.round(lineLengthFeet(l.coords))} LF
                  </span>
                  {!readOnly ? <MapBtn onClick={() => deleteLine(l.id)}>Delete</MapBtn> : null}
                </div>
              ))}
            </div>
          </CbCard>
        ) : null}
      </div>

      <TotalsStrip totals={totals} />

      {/* pitch picker */}
      <CbSheet open={!!pitchSheet} onClose={() => setPitchSheet(null)} title="Pitch">
        <div className="grid grid-cols-4 gap-2">
          {PITCH_OPTIONS.map((p) => (
            <CbButton
              key={p}
              size="md"
              variant={
                plan.sections.find((s) => s.id === pitchSheet)?.pitch === p ? "primary" : "secondary"
              }
              onClick={() => pitchSheet && setPitch(pitchSheet, p)}
            >
              {p}
            </CbButton>
          ))}
        </div>
      </CbSheet>

      {/* edge / line type picker */}
      <CbSheet
        open={!!typeSheet}
        onClose={() => {
          setTypeSheet(null);
          if (typeSheet?.kind === "line") setDraft([]);
        }}
        title={typeSheet?.kind === "edge" ? "Label this edge" : "Label this line"}
      >
        <div className="grid grid-cols-2 gap-2">
          {CB_EDGE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => applyType(t)}
              className="rounded-[12px] px-3 py-3 text-left text-[15px] font-semibold"
              style={{
                background: `${CB_EDGE_COLORS[t]}22`,
                color: CB_EDGE_COLORS[t],
                border: `1px solid ${CB_EDGE_COLORS[t]}66`,
                minHeight: 52,
              }}
            >
              {CB_EDGE_LABELS[t]}
            </button>
          ))}
        </div>
      </CbSheet>

      <CbSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Measurement settings">
        <div className="space-y-3">
          {overallConfidence ? (
            <CbCard className="p-4">
              <p className="text-[14px] font-semibold">AI confidence</p>
              <p className="cb-num mt-1 text-[24px] font-bold" style={{ color: confidenceColor(overallConfidence.percent / 100) }}>
                {overallConfidence.percent}% · {overallConfidence.label}
              </p>
              {overallConfidence.low ? <p className="mt-1 text-[13px]">Review {overallConfidence.low} low-confidence edge{overallConfidence.low === 1 ? "" : "s"}.</p> : null}
            </CbCard>
          ) : null}
          {aiPlan?.sections.length ? <CbButton block variant="secondary" onClick={() => setShowTrace((value) => !value)}>{showTrace ? "Hide AI outline" : "Show AI outline"}</CbButton> : null}
          <CbButton block variant="secondary" onClick={toggleSquareUp}>
            {squareUp ? "Un-square (use raw trace)" : "Square up edges"}
          </CbButton>
          <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
            Squaring snaps edges onto the building's own axis. Turn it off for curved,
            octagonal or bay-window roofs.
          </p>
          {activeSection?.aiRing?.length ? <CbButton block variant="secondary" onClick={restoreActiveAiOutline}><RotateCcw size={18} /> Restore AI outline</CbButton> : canReset ? <CbButton block variant="secondary" onClick={() => { onReset?.(); setSettingsOpen(false); }}><RotateCcw size={18} /> Restore AI outline</CbButton> : null}
          <CbButton block variant="secondary" onClick={redo} disabled={!future.length}>Redo</CbButton>
          {measurePins.length ? <CbButton block variant="danger" onClick={() => { onClearPins?.(); setSettingsOpen(false); }}>Clear roof pins</CbButton> : null}
        </div>
      </CbSheet>
    </div>
  );
}

function MapBtn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[10px] px-3 text-[13px] font-semibold"
      style={{
        minHeight: 40,
        background: active ? "var(--cb-accent, #1F425D)" : "rgba(12,16,22,0.78)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.22)",
        opacity: disabled ? 0.45 : 1,
        backdropFilter: "blur(6px)",
      }}
    >
      {children}
    </button>
  );
}

function DragPointHandle({
  x,
  y,
  label,
  color,
  size,
  onPointerDown,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  size: number;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onPointerDown}
      className="pointer-events-auto absolute z-30 grid place-items-center"
      style={{
        left: x - 22,
        top: y - 22,
        width: 44,
        height: 44,
        border: 0,
        background: "transparent",
        touchAction: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          border: "3px solid var(--cb-surface)",
          background: color,
          boxShadow: "0 2px 8px rgba(0,0,0,0.48)",
        }}
      />
    </button>
  );
}

function MapIconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px]"
      style={{
        background: "rgba(12,16,22,0.82)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.22)",
        opacity: disabled ? 0.45 : 1,
        backdropFilter: "blur(6px)",
      }}
    >
      {children}
    </button>
  );
}

function TotalsStrip({ totals }: { totals: CbPlanTotals }) {
  const items: [string, string][] = [
    ["Squares", totals.total_squares.toFixed(2)],
    ["Area", `${totals.total_area_sqft.toLocaleString()} sf`],
    ["Ridge", `${Math.round(totals.ridge_lf)} LF`],
    ["Hip", `${Math.round(totals.hip_lf)} LF`],
    ["Valley", `${Math.round(totals.valley_lf)} LF`],
    ["Rake", `${Math.round(totals.rake_lf)} LF`],
    ["Eave", `${Math.round(totals.eave_lf)} LF`],
    ["Gutter", `${Math.round(totals.gutter_lf)} LF`],
    ["Wall flash", `${Math.round(totals.wall_flashing_lf)} LF`],
    ["Step flash", `${Math.round(totals.step_flashing_lf)} LF`],
  ];
  return (
    <CbCard className="p-4">
      <p className="text-[12px] uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
        Live totals
      </p>
      <div className="mt-2 grid grid-cols-2 gap-y-2 sm:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 pr-3">
            <span className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
              {k}
            </span>
            <span className="cb-num text-[15px] font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </CbCard>
  );
}

export { CB_EMPTY_PLAN };
