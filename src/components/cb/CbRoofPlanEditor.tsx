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
import "mapbox-gl/dist/mapbox-gl.css";

type Tool = "select" | "line";

const uid = () => Math.random().toString(36).slice(2, 10);

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
  onTogglePinDrop,
  onClearPins,
  onMeasure,
  measuring = false,
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
  onTogglePinDrop?: () => void;
  onClearPins?: () => void;
  onMeasure?: () => void;
  measuring?: boolean;
}) {
  const { data: token } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
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
  /** Footprint locked = corners frozen, taps label perimeter edges instead. */
  const [locked, setLocked] = useState(false);
  const [pitchSheet, setPitchSheet] = useState<string | null>(null);
  const [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);

  const selected = plan.sections.find((s) => s.id === selectedId) ?? null;
  const totals = useMemo(() => planTotals(plan), [plan]);

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
      preserveDrawingBuffer: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    /**
     * Idempotent: a phone can miss the one-shot `load` event (slow token fetch,
     * zero-height container, style already parsed). Everything below is safe to
     * call again, so we can retry from several signals until it sticks.
     */
    const initLayers = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getLayer("cb-fill-l")) {
        setReady(true);
        return;
      }
      const empty = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;
      const addSource = (id: string) => {
        if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: empty });
      };
      addSource("cb-fill");
      addSource("cb-edge");
      addSource("cb-line");
      addSource("cb-chip");
      addSource("cb-measure-pin");


      map.addLayer({
        id: "cb-fill-l",
        type: "fill",
        source: "cb-fill",
        paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] },
      });
      map.addLayer({
        id: "cb-fill-outline",
        type: "line",
        source: "cb-fill",
        paint: {
          "line-color": "#ffb347",
          "line-width": 2.5,
          "line-dasharray": [2, 1.4],
        },
      });
      map.addLayer({
        id: "cb-edge-l",
        type: "line",
        source: "cb-edge",
        paint: { "line-color": ["get", "color"], "line-width": 5, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "cb-edge-hit",
        type: "line",
        source: "cb-edge",
        paint: { "line-color": "#000", "line-opacity": 0.01, "line-width": 26 },
      });
      map.addLayer({
        id: "cb-line-l",
        type: "line",
        source: "cb-line",
        paint: { "line-color": ["get", "color"], "line-width": 5 },
      });
      map.addLayer({
        id: "cb-line-hit",
        type: "line",
        source: "cb-line",
        paint: { "line-color": "#000", "line-opacity": 0.01, "line-width": 26 },
      });
      map.addLayer({
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
      map.addLayer({
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
      map.addLayer({
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
      setReady(true);
    };

    map.on("load", initLayers);
    map.on("style.load", initLayers);
    map.on("idle", initLayers);
    initLayers();
    // A late style parse on a slow phone still gets picked up.
    const retry = window.setInterval(initLayers, 800);
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 15000);
    // Guard against a zero-height container at mount.
    const resize = window.setTimeout(() => map.resize(), 300);

    map.on("move", () => setTick((t) => t + 1));
    mapRef.current = map;
    setMapVersion((v) => v + 1);
    return () => {
      window.clearInterval(retry);
      window.clearTimeout(stopRetry);
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
    if (!map || !ready) return;

    const fills: GeoJSON.Feature[] = plan.sections.map((s) => ({
      type: "Feature",
      properties: {
        id: s.id,
        color: s.color,
        opacity: s.id === selectedId ? 0.4 : 0.26,
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
    if (draft.length >= 2) {
      lines.push({
        type: "Feature",
        properties: { id: "draft", color: "#ffffff", label: `${Math.round(lineLengthFeet(draft))} LF` },
        geometry: { type: "LineString", coordinates: draft },
      });
    }

    const set = (id: string, features: GeoJSON.Feature[]) =>
      (map.getSource(id) as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features,
      });
    set("cb-fill", fills);
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
  }, [plan, ready, selectedId, draft, measurePins]);

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
      el.style.cssText =
        "width:22px;height:22px;border-radius:999px;background:#f97316;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)";
      return new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
    });
  }, [measurePins, ready, mapVersion]);

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
        setDraft((d) => [...d, [e.lngLat.lng, e.lngLat.lat]]);
        cbHaptic(6);
        return;
      }
      if (!map.getLayer("cb-fill-l")) return;
      const hits = map.queryRenderedFeatures(e.point, { layers: ["cb-edge-hit", "cb-fill-l"] });

      const edgeHit = hits.find((f) => f.layer?.id === "cb-edge-hit");
      if (edgeHit && !readOnly) {
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
  }, [mapVersion, ready, tool, readOnly, pinDropMode, onPinDrop]);

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
    longPress: number | null;
    x: number;
    y: number;
  } | null>(null);

  function beginVertexDrag(
    e: React.PointerEvent,
    sectionId: string,
    index: number,
    kind: "vertex" | "midpoint",
  ) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    cbHaptic(8);

    let vIndex = index;
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
      onPlanChange(updateSection(sectionId, (sec) => ({ ...sec, ring, edges: nextEdges })), {
        user: true,
      });
    }

    dragRef.current = {
      start: planRef.current,
      moved: false,
      longPress:
        kind === "vertex"
          ? window.setTimeout(() => {
              if (dragRef.current?.moved) return;
              deleteVertex(sectionId, vIndex);
              dragRef.current = null;
              setLoupe(null);
            }, 550)
          : null,
      x: e.clientX,
      y: e.clientY,
    };
    setSelectedId(sectionId);
    setLoupe({ x: e.clientX, y: e.clientY });
    paintLoupe(e.clientX, e.clientY);

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6) {
        d.moved = true;
        if (d.longPress) {
          clearTimeout(d.longPress);
          d.longPress = null;
        }
      }
      const map = mapRef.current;
      const host = containerRef.current;
      if (!map || !host) return;
      const rect = host.getBoundingClientRect();
      const ll = map.unproject([ev.clientX - rect.left, ev.clientY - rect.top]);
      const s = planRef.current.sections.find((x) => x.id === sectionId);
      if (!s) return;
      const snapped = snapVertex(s.ring, vIndex, [ll.lng, ll.lat]);
      const ring = s.ring.map((p, i) => (i === vIndex ? snapped : p));
      onPlanChange(updateSection(sectionId, (sec) => ({ ...sec, ring })), { user: true });
      setLoupe({ x: ev.clientX, y: ev.clientY });
      requestAnimationFrame(() => paintLoupe(ev.clientX, ev.clientY));
    };

    const up = () => {
      const d = dragRef.current;
      if (d) {
        if (d.longPress) clearTimeout(d.longPress);
        if (d.moved || kind === "midpoint") setPast((p) => [...p.slice(-40), d.start]);
      }
      dragRef.current = null;
      setLoupe(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
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

  function setPitch(id: string, pitch: string) {
    commit(updateSection(id, (s) => ({ ...s, pitch })));
    setPitchSheet(null);
  }

  /**
   * Draw first, label later: finishing a line drops it in unlabeled and keeps
   * the line tool armed so every ridge/hip/valley can be drawn in one pass.
   */
  function finishLine() {
    if (draft.length < 2) {
      setDraft([]);
      setTool("select");
      return;
    }
    commit({
      ...plan,
      lines: [...plan.lines, { id: uid(), coords: draft, type: "unlabeled" }],
    });
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

  const handleSection = selected ?? (plan.sections.length === 1 ? plan.sections[0] : null);
  const vertexHandles: { x: number; y: number; index: number }[] = [];
  const midHandles: { x: number; y: number; index: number }[] = [];
  if (handleSection && !readOnly && ready) {
    handleSection.ring.forEach((p, i) => {
      const pt = project(p);
      if (pt) vertexHandles.push({ ...pt, index: i });
      const m = project(edgeCenter(handleSection.ring, i));
      if (m) midHandles.push({ ...m, index: i });
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
          <div className="pointer-events-none absolute inset-0" key={tick}>
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

          {/* draft line overlay — always visible, with per-segment lengths */}
          {tool === "line" && !readOnly && draft.length && mapRef.current
            ? (() => {
                const map = mapRef.current!;
                const pts = draft.map((c) => map.project(c as [number, number]));
                return (
                  <svg
                    className="pointer-events-none absolute inset-0"
                    style={{ width: "100%", height: "100%" }}
                  >
                    {pts.length >= 2 ? (
                      <polyline
                        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={4}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }}
                      />
                    ) : null}
                    {pts.slice(0, -1).map((p, i) => {
                      const q = pts[i + 1];
                      const len = Math.round(lineLengthFeet([draft[i], draft[i + 1]]));
                      const mx = (p.x + q.x) / 2;
                      const my = (p.y + q.y) / 2;
                      return (
                        <g key={`seg-${i}`}>
                          <rect
                            x={mx - 26}
                            y={my - 22}
                            width={52}
                            height={20}
                            rx={6}
                            fill="rgba(0,0,0,0.78)"
                          />
                          <text
                            x={mx}
                            y={my - 8}
                            textAnchor="middle"
                            fontSize={12}
                            fontWeight={700}
                            fill="#fff"
                          >
                            {len} LF
                          </text>
                        </g>
                      );
                    })}
                    {pts.map((p, i) => (
                      <circle
                        key={`pt-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={6}
                        fill="#ffffff"
                        stroke="#111"
                        strokeWidth={2}
                      />
                    ))}
                  </svg>
                );
              })()
            : null}

          {/* toolbar */}

          {!readOnly ? (
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              <MapBtn active={tool === "select"} onClick={() => { setTool("select"); setDraft([]); }}>
                Edit
              </MapBtn>
              <MapBtn active={tool === "line"} onClick={() => setTool("line")}>
                Line
              </MapBtn>
              <MapBtn active={pinDropMode} onClick={onTogglePinDrop}>
                {pinDropMode ? "Tap roof now" : "Drop measurement pin"}
              </MapBtn>
              {measurePins.length ? <MapBtn onClick={onClearPins}>Clear pins</MapBtn> : null}
              <MapBtn onClick={undo} disabled={!past.length}>
                Undo
              </MapBtn>
              <MapBtn onClick={redo} disabled={!future.length}>
                Redo
              </MapBtn>
              {canReset ? <MapBtn onClick={onReset}>Reset to satellite</MapBtn> : null}
            </div>
          ) : (
            <div className="absolute left-3 top-3">
              <CbChip>Read only — report generated</CbChip>
            </div>
          )}

          {tool === "line" && !readOnly ? (
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
              <MapBtn onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length}>
                Undo point
              </MapBtn>
              <MapBtn onClick={finishLine} disabled={draft.length < 2}>
                Finish line ({Math.round(lineLengthFeet(draft))} LF)
              </MapBtn>
            </div>
          ) : null}
        </div>

        {/* Always-visible measure action — never hunt for it down the page. */}
        {onMeasure && !readOnly ? (
          <div className="border-t px-4 py-3" style={{ borderColor: "var(--cb-border)" }}>
            <CbButton
              block
              onClick={measurePins.length ? onMeasure : onTogglePinDrop}
              loading={measuring}
              loadingText="Measuring…"
            >
              {measurePins.length
                ? `Measure ${measurePins.length} pinned roof${measurePins.length === 1 ? "" : "s"}`
                : pinDropMode
                  ? "Tap the roof to drop a pin"
                  : "Drop a pin on the roof"}
            </CbButton>
            {!ready ? (
              <p className="mt-2 text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                Map is still loading — any measurements listed below are still valid.
              </p>
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
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
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
                </button>
                <span className="cb-num text-[15px] font-semibold">
                  {Math.round(sectionActualAreaSqft(s)).toLocaleString()} sf
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <MapBtn onClick={() => setPitchSheet(s.id)} disabled={readOnly}>
                  Pitch {s.pitch}
                </MapBtn>
                <MapBtn onClick={() => setSelectedId(s.id)}>
                  {selectedId === s.id ? "Editing" : "Edit shape"}
                </MapBtn>
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
                  <span className="text-[14px]" style={{ color: CB_EDGE_COLORS[l.type] }}>
                    {CB_EDGE_LABELS[l.type]}
                  </span>
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
        title={typeSheet?.kind === "line" ? "Label this line" : "Label this edge"}
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
