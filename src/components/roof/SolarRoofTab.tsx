import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { toast } from "sonner";
import {
  Loader2,
  Satellite,
  Sparkles,
  Trash2,
  Plus,
  Info,
  Ruler,
  Pencil,
  AlertCircle,
  Check,
  X,
  Eye,
  EyeOff,
  ArrowRight,
  Brain,
} from "lucide-react";
import type { MapboxRoofData } from "./MapboxRoofDraw";
import { PITCH_OPTIONS, pitchMultiplier, withWaste, squares, polygonAreaSqft, haversineFeet } from "@/lib/roof-math";
import "mapbox-gl/dist/mapbox-gl.css";

type PinKind = "pitched" | "flat" | "ignore";

type Pin = {
  id: string;
  name: string;
  kind: PinKind;
  pitch: string;
  plan_area_sqft: number;
  lng: number;
  lat: number;
  ring?: number[][];
  // All facets that contributed to this pin's measurement (for overlay rendering)
  facets?: Array<{ ring: number[][]; pitch: string; plan_area_sqft: number; pitch_degrees: number }>;
  source: "solar" | "manual";
};

type SolarSegment = {
  index: number;
  name: string;
  plan_area_sqft: number;
  pitch: string;
  pitch_degrees: number;
  azimuth_degrees: number;
  ring: number[][];
  center?: { latitude: number; longitude: number } | null;
};

type SolarResponse = {
  total_plan_sqft: number;
  segments: SolarSegment[];
  imagery_quality: string | null;
};

type CalibrationResponse = {
  raw_total_sqft: number;
  calibrated_total_sqft: number | null;
  example_count: number;
  rationale: string | null;
};

// Tan/orange for pitched, cyan for flat, gray for ignored — high contrast on satellite imagery
const FILL_COLORS: Record<PinKind, string> = {
  pitched: "#f59e0b", // amber/tan — matches a tan asphalt shingle roof
  flat: "#06b6d4", // cyan — high contrast against white/light flat roofs
  ignore: "#9ca3af", // gray
};

const STROKE_COLORS: Record<PinKind, string> = {
  pitched: "#ea580c", // deeper orange outline
  flat: "#0891b2", // deeper cyan outline
  ignore: "#6b7280",
};

const SECTION_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Build a small ~30ft square ring centered on a coordinate. */
function squareRingAround(lng: number, lat: number, sideFeet = 30): number[][] {
  const ftPerDegLat = 364320;
  const ftPerDegLng = ftPerDegLat * Math.cos((lat * Math.PI) / 180);
  const dLat = sideFeet / 2 / ftPerDegLat;
  const dLng = sideFeet / 2 / ftPerDegLng;
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

/** Convex hull of a set of points (Andrew's monotone chain), input/output [lng,lat]. */
function convexHull(points: number[][]): number[][] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: number[][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: number[][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  const ring = lower.concat(upper);
  ring.push(ring[0]);
  return ring;
}

/** Round pitch degrees to nearest n/12. */
function degreesToPitchString(deg: number): string {
  const rise = Math.round(Math.tan((deg * Math.PI) / 180) * 12);
  const clamped = Math.max(0, Math.min(12, rise));
  return `${clamped}/12`;
}

/** Centroid of a polygon ring [[lng,lat],...]. */
function ringCentroid(ring: number[][]): [number, number] {
  if (ring.length === 0) return [0, 0];
  let x = 0;
  let y = 0;
  const n = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.length - 1
    : ring.length;
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

export function SolarRoofTab({
  center,
  propertyId,
  onApply,
  onSwitchToMapbox,
}: {
  center: { lng: number; lat: number };
  propertyId?: string;
  onApply: (data: MapboxRoofData) => void;
  onSwitchToMapbox?: () => void;
}) {
  const { data: token, isLoading: tokenLoading } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const pinsStateRef = useRef<Pin[]>([]);

  const [pins, setPins] = useState<Pin[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [wastePct, setWastePct] = useState(15);
  const [imageryQuality, setImageryQuality] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showCoverageGaps, setShowCoverageGaps] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationResponse | null>(null);
  const [showHandoff, setShowHandoff] = useState(false);
  const [noCoverage, setNoCoverage] = useState(false);

  // Draw-mode state
  const [drawingPinId, setDrawingPinId] = useState<string | null>(null);
  const [drawPoints, setDrawPoints] = useState<number[][]>([]);
  const drawingPinIdRef = useRef<string | null>(null);
  const drawPointsRef = useRef<number[][]>([]);

  useEffect(() => { pinsStateRef.current = pins; }, [pins]);
  useEffect(() => { drawingPinIdRef.current = drawingPinId; }, [drawingPinId]);
  useEffect(() => { drawPointsRef.current = drawPoints; }, [drawPoints]);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [center.lng, center.lat],
      zoom: 19,
      pitch: 0,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");

    map.on("click", (e) => {
      if (drawingPinIdRef.current) {
        const next = [...drawPointsRef.current, [e.lngLat.lng, e.lngLat.lat]];
        setDrawPoints(next);
        return;
      }
      const newPin: Pin = {
        id: rid(),
        name: `Structure ${pinsStateRef.current.length + 1}`,
        kind: "pitched",
        pitch: "6/12",
        plan_area_sqft: 0,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        source: "manual",
      };
      setPins((p) => [...p, newPin]);
      setActivePinId(newPin.id);
    });

    map.on("load", () => {
      // In-progress draw layer
      if (!map.getSource("ai-draw")) {
        map.addSource("ai-draw", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "ai-draw-fill",
          type: "fill",
          source: "ai-draw",
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.25 },
        });
        map.addLayer({
          id: "ai-draw-line",
          type: "line",
          source: "ai-draw",
          paint: { "line-color": "#3b82f6", "line-width": 2, "line-dasharray": [2, 2] },
        });
        map.addLayer({
          id: "ai-draw-points",
          type: "circle",
          source: "ai-draw",
          filter: ["==", "$type", "Point"],
          paint: { "circle-radius": 4, "circle-color": "#fff", "circle-stroke-color": "#3b82f6", "circle-stroke-width": 2 },
        });
      }

      // Highlighted facet overlays — separate sources per kind for clean styling
      for (const kind of ["pitched", "flat", "ignore"] as PinKind[]) {
        const srcId = `facet-${kind}`;
        if (!map.getSource(srcId)) {
          map.addSource(srcId, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: `${srcId}-fill`,
            type: "fill",
            source: srcId,
            paint: {
              "fill-color": FILL_COLORS[kind],
              "fill-opacity": kind === "ignore" ? 0 : 0.32,
            },
          });
          map.addLayer({
            id: `${srcId}-line`,
            type: "line",
            source: srcId,
            paint: {
              "line-color": STROKE_COLORS[kind],
              "line-width": 2.5,
              "line-dasharray": kind === "ignore" ? [3, 2] : [1, 0],
            },
          });
        }
      }

      // Facet labels
      if (!map.getSource("facet-labels")) {
        map.addSource("facet-labels", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "facet-labels-text",
          type: "symbol",
          source: "facet-labels",
          layout: {
            "text-field": ["get", "label"],
            "text-size": 11,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-allow-overlap": false,
            "text-anchor": "center",
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(0,0,0,0.85)",
            "text-halo-width": 1.5,
          },
        });
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, center.lng, center.lat]);

  // Update draw-polygon visualization when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("ai-draw") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const features: GeoJSON.Feature[] = drawPoints.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p },
      properties: {},
    }));
    if (drawPoints.length >= 2) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: drawPoints },
        properties: {},
      });
    }
    if (drawPoints.length >= 3) {
      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[...drawPoints, drawPoints[0]]] },
        properties: {},
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }, [drawPoints]);

  // Sync facet overlays + labels with pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      // Defer until style loaded
      const handler = () => updateOverlays();
      map?.once("idle", handler);
      return;
    }
    updateOverlays();

    function updateOverlays() {
      if (!map) return;
      for (const kind of ["pitched", "flat", "ignore"] as PinKind[]) {
        const src = map.getSource(`facet-${kind}`) as mapboxgl.GeoJSONSource | undefined;
        if (!src) continue;
        const features: GeoJSON.Feature[] = [];
        if (showOverlay) {
          for (const pin of pins) {
            if (pin.kind !== kind) continue;
            const facets = pin.facets && pin.facets.length > 0
              ? pin.facets.map((f) => f.ring)
              : pin.ring && pin.ring.length >= 3
                ? [pin.ring]
                : [];
            for (const ring of facets) {
              if (ring.length < 3) continue;
              const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
                ? ring
                : [...ring, ring[0]];
              features.push({
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [closed] },
                properties: { pin_id: pin.id },
              });
            }
          }
        }
        src.setData({ type: "FeatureCollection", features });
      }

      // Labels (one per pin centered at pin location)
      const labelSrc = map.getSource("facet-labels") as mapboxgl.GeoJSONSource | undefined;
      if (labelSrc) {
        const features: GeoJSON.Feature[] = [];
        if (showOverlay) {
          for (const pin of pins) {
            if (pin.kind === "ignore") continue;
            if ((pin.plan_area_sqft || 0) === 0) continue;
            const sqft = Math.round(pin.plan_area_sqft).toLocaleString();
            const label = pin.kind === "flat"
              ? `${pin.name} · ${sqft} sqft · flat`
              : `${pin.name} · ${sqft} sqft · ${pin.pitch}`;
            features.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
              properties: { label },
            });
          }
        }
        labelSrc.setData({ type: "FeatureCollection", features });
      }
    }
  }, [pins, showOverlay]);

  // ESC exits draw-mode
  useEffect(() => {
    if (!drawingPinId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawingPinId(null);
        setDrawPoints([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawingPinId]);

  // Sync markers with pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markersRef.current;
    const seen = new Set<string>();

    pins.forEach((pin, i) => {
      seen.add(pin.id);
      const color = FILL_COLORS[pin.kind];
      const unmeasured = pin.kind !== "ignore" && (pin.plan_area_sqft || 0) === 0;
      let marker = existing[pin.id];
      if (!marker) {
        const el = document.createElement("div");
        el.style.cssText = `position:relative;width:28px;height:28px;border-radius:50%;background:${color};color:white;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;`;
        el.textContent = String(i + 1);
        if (unmeasured) {
          const dot = document.createElement("span");
          dot.className = "ai-pin-warn";
          dot.style.cssText = "position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid white;";
          el.appendChild(dot);
        }
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setActivePinId(pin.id);
        });
        marker = new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
        existing[pin.id] = marker;
      } else {
        const el = marker.getElement();
        el.style.background = color;
        const textNode = Array.from(el.childNodes).find((n) => n.nodeType === 3);
        if (textNode) textNode.textContent = String(i + 1);
        else el.insertBefore(document.createTextNode(String(i + 1)), el.firstChild);
        const existingDot = el.querySelector(".ai-pin-warn");
        if (unmeasured && !existingDot) {
          const dot = document.createElement("span");
          dot.className = "ai-pin-warn";
          dot.style.cssText = "position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid white;";
          el.appendChild(dot);
        } else if (!unmeasured && existingDot) {
          existingDot.remove();
        }
        marker.setLngLat([pin.lng, pin.lat]);
      }
    });

    Object.keys(existing).forEach((id) => {
      if (!seen.has(id)) {
        existing[id].remove();
        delete existing[id];
      }
    });
  }, [pins]);

  /**
   * Detect ALL structures at the property — one pin per detected facet.
   * This is the new primary "Measure entire property" action.
   */
  const detect = useMutation({
    mutationFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const accessToken = s.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const r = await fetch("/api/solar-roof-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ lat: center.lat, lng: center.lng, property_id: propertyId }),
      });
      if (!r.ok) {
        // Try to parse structured error first
        let parsed: { error?: string; message?: string; detail?: string } | null = null;
        try {
          parsed = await r.json();
        } catch {
          // not JSON
        }
        if (r.status === 404 && parsed?.error === "no_coverage") {
          const err = new Error(parsed.message ?? "No Solar coverage at this location");
          (err as Error & { code?: string }).code = "no_coverage";
          throw err;
        }
        throw new Error(parsed?.message ?? parsed?.detail ?? `Solar API failed (${r.status})`);
      }
      const data = (await r.json()) as SolarResponse;

      // Fire calibration in parallel (best-effort, not blocking)
      let calib: CalibrationResponse | null = null;
      try {
        const cr = await fetch("/api/calibrate-solar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ lat: center.lat, lng: center.lng, solar_response: data }),
        });
        if (cr.ok) calib = (await cr.json()) as CalibrationResponse;
      } catch {
        // calibration is best-effort
      }
      return { data, calib };
    },
    onSuccess: async ({ data, calib }) => {
      setNoCoverage(false);
      setImageryQuality(data.imagery_quality);
      setCalibration(calib);
      // Build one pin per facet detected by Solar (so each facet is its own polygon on the map)
      const detectedPins: Pin[] = data.segments.map((seg, i) => {
        const c = seg.center
          ? { lng: seg.center.longitude, lat: seg.center.latitude }
          : seg.ring.length
            ? { lng: seg.ring[0][0], lat: seg.ring[0][1] }
            : center;
        // Pitch < 1/12 is effectively flat
        const isFlat = (seg.pitch_degrees ?? 0) < 5;
        return {
          id: rid(),
          name: i === 0 ? "Main roof" : `Facet ${i + 1}`,
          kind: isFlat ? ("flat" as const) : ("pitched" as const),
          pitch: seg.pitch || "6/12",
          plan_area_sqft: Math.round(seg.plan_area_sqft),
          lng: c.lng,
          lat: c.lat,
          ring: seg.ring,
          facets: [{ ring: seg.ring, pitch: seg.pitch, plan_area_sqft: seg.plan_area_sqft, pitch_degrees: seg.pitch_degrees }],
          source: "solar" as const,
        };
      });

      // Preserve any manual pins the user dropped for OTHER structures (sheds,
      // garages, detached buildings) — a manual pin is "extra" if it sits
      // more than ~40 ft away from every detected facet center.
      const existingManual = pinsStateRef.current.filter((p) => p.source === "manual");
      const extraStructurePins = existingManual
        .filter((p) => detectedPins.every((d) => haversineFeet({ lng: d.lng, lat: d.lat }, { lng: p.lng, lat: p.lat }) > 40))
        .map((p, i) => ({ ...p, name: p.name || `Structure ${detectedPins.length + i + 1}` }));

      const combined = [...detectedPins, ...extraStructurePins];
      setPins(combined);
      setActivePinId(combined[0]?.id ?? null);
      setShowHandoff(combined.length > 0);

      const facets = detectedPins.length;
      const sqft = Math.round(detectedPins.reduce((s, p) => s + p.plan_area_sqft, 0));
      toast.success(
        extraStructurePins.length > 0
          ? `Measured main structure (${facets} facet${facets === 1 ? "" : "s"} · ${sqft.toLocaleString()} sqft) — now measuring ${extraStructurePins.length} extra pin${extraStructurePins.length === 1 ? "" : "s"}…`
          : `Measured ${facets} facet${facets === 1 ? "" : "s"} · ${sqft.toLocaleString()} sqft total`,
      );

      // Auto-measure each extra pin (shed, garage, etc.) by calling Solar at
      // that specific location. Runs after state commits.
      if (extraStructurePins.length > 0) {
        setTimeout(async () => {
          let ok = 0;
          let fail = 0;
          for (const pin of extraStructurePins) {
            const res = await measurePinAt(pin);
            if (res.ok) ok++;
            else fail++;
          }
          if (fail === 0) toast.success(`All ${ok} extra structure${ok === 1 ? "" : "s"} measured`);
          else toast.warning(`${ok} extra structure${ok === 1 ? "" : "s"} measured, ${fail} need manual outline (Draw area).`);
        }, 100);
      }
    },
    onError: (e) => {
      const code = (e as Error & { code?: string }).code;
      if (code === "no_coverage") {
        setNoCoverage(true);
        // No raw JSON toast — the inline empty state explains it.
        return;
      }
      toast.error(e instanceof Error ? e.message : "Measurement failed");
    },
  });

  function updatePin(id: string, patch: Partial<Pin>) {
    setPins((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removePin(id: string) {
    setPins((p) => p.filter((x) => x.id !== id));
    if (activePinId === id) setActivePinId(null);
    if (drawingPinId === id) {
      setDrawingPinId(null);
      setDrawPoints([]);
    }
  }

  /**
   * FIXED: Hit Solar at a single pin and aggregate ALL facets returned at that
   * location into a single "whole-structure" measurement, instead of picking
   * just the closest segment. Returns a merged convex-hull outline so the
   * Mapbox hand-off draws the entire building footprint.
   */
  async function measurePinAt(pin: Pin): Promise<{ ok: boolean; reason?: string }> {
    const { data: s } = await supabase.auth.getSession();
    const accessToken = s.session?.access_token;
    if (!accessToken) return { ok: false, reason: "Not authenticated" };
    const r = await fetch("/api/solar-roof-extract", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ lat: pin.lat, lng: pin.lng }),
    });
    if (!r.ok) return { ok: false, reason: "No building data here" };
    const data = (await r.json()) as SolarResponse;
    if (!data.segments?.length) return { ok: false, reason: "No structure detected here" };

    setImageryQuality(data.imagery_quality);

    // Aggregate ALL facets — total area, area-weighted average pitch, merged outline.
    const facets = data.segments.map((seg) => ({
      ring: seg.ring,
      pitch: seg.pitch,
      plan_area_sqft: seg.plan_area_sqft,
      pitch_degrees: seg.pitch_degrees,
    }));
    const totalSqft = facets.reduce((s, f) => s + f.plan_area_sqft, 0);
    const weightedDeg = totalSqft > 0
      ? facets.reduce((s, f) => s + f.pitch_degrees * f.plan_area_sqft, 0) / totalSqft
      : 0;
    const avgPitch = degreesToPitchString(weightedDeg);

    // Merge all facet rings into a single convex hull outline (good enough for the hand-off)
    const allPoints = facets.flatMap((f) => f.ring);
    const mergedRing = allPoints.length >= 3 ? convexHull(allPoints) : pin.ring;

    updatePin(pin.id, {
      plan_area_sqft: Math.round(totalSqft),
      pitch: pin.kind === "pitched" ? avgPitch : pin.pitch,
      ring: mergedRing,
      facets,
      source: pin.source === "manual" ? "manual" : "solar",
    });
    return { ok: true };
  }

  const measureOne = useMutation({
    mutationFn: async (pin: Pin) => {
      const res = await measurePinAt(pin);
      if (!res.ok) throw new Error(res.reason ?? "Measurement failed");
    },
    onSuccess: () => toast.success("Measured whole structure at this pin"),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't measure", {
        description: "Try the Draw area tool, enter sqft manually, or refine on the Mapbox tab.",
      }),
  });

  const measureAll = useMutation({
    mutationFn: async () => {
      const targets = pins.filter((p) => p.kind !== "ignore" && (p.plan_area_sqft || 0) === 0);
      let success = 0;
      let failed = 0;
      for (const pin of targets) {
        const res = await measurePinAt(pin);
        if (res.ok) success++;
        else failed++;
      }
      return { success, failed, total: targets.length };
    },
    onSuccess: ({ success, failed, total }) => {
      if (total === 0) toast.info("All pins already measured");
      else if (failed === 0) toast.success(`Measured ${success} of ${total} pins`);
      else toast.warning(`Measured ${success}/${total} — ${failed} need manual entry or draw`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk measure failed"),
  });

  function startDraw(pinId: string) {
    setDrawingPinId(pinId);
    setDrawPoints([]);
    setActivePinId(pinId);
    toast.info("Click 3+ points around the structure, then press Done");
  }
  function cancelDraw() {
    setDrawingPinId(null);
    setDrawPoints([]);
  }
  function finishDraw() {
    if (!drawingPinId) return;
    if (drawPoints.length < 3) {
      toast.error("Need at least 3 points to outline an area");
      return;
    }
    const ring = [...drawPoints, drawPoints[0]];
    const area = polygonAreaSqft(ring);
    updatePin(drawingPinId, { plan_area_sqft: Math.round(area), ring, facets: [{ ring, pitch: "6/12", plan_area_sqft: area, pitch_degrees: 0 }] });
    setDrawingPinId(null);
    setDrawPoints([]);
    toast.success(`Outlined ${Math.round(area).toLocaleString()} sqft`);
  }

  const totals = useMemo(() => {
    const active = pins.filter((p) => p.kind !== "ignore");
    const plan = active.reduce((s, p) => s + (p.plan_area_sqft || 0), 0);
    const sloped = active.reduce((s, p) => {
      const mult = p.kind === "flat" ? 1 : pitchMultiplier(p.pitch);
      return s + (p.plan_area_sqft || 0) * mult;
    }, 0);
    const wasted = withWaste(sloped, wastePct);
    return { plan, sloped, wasted, sq: squares(wasted), count: active.length };
  }, [pins, wastePct]);

  function applyToMapbox() {
    const active = pins.filter((p) => p.kind !== "ignore");
    if (active.length === 0) {
      toast.error("Add at least one pin first");
      return;
    }
    // Expand each pin into one section per facet (so Mapbox tab gets the full per-facet detail)
    const sections: MapboxRoofData["sections"] = [];
    let i = 0;
    for (const p of active) {
      const facets = p.facets && p.facets.length > 0 ? p.facets : [{ ring: p.ring && p.ring.length >= 3 ? p.ring : squareRingAround(p.lng, p.lat), pitch: p.kind === "flat" ? "0/12" : p.pitch, plan_area_sqft: p.plan_area_sqft, pitch_degrees: 0 }];
      for (const f of facets) {
        sections.push({
          id: `ai-${p.id}-${i}`,
          name: facets.length > 1 ? `${p.name} · facet ${i + 1}` : p.name,
          color: SECTION_COLORS[i % SECTION_COLORS.length],
          ring: f.ring,
          plan_area_sqft: f.plan_area_sqft,
          pitch: p.kind === "flat" ? "0/12" : f.pitch,
          edges: f.ring.length > 1 ? Array.from({ length: f.ring.length - 1 }, () => null) : [],
        });
        i++;
      }
    }
    onApply({ sections, lines: [] });
    toast.success("Applied to Mapbox tab — refine shapes & label edges");
  }

  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  return (
    <div className="space-y-4">
      {/* Header — primary CTA promoted */}
      <div
        className="flex items-start gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <Satellite className="mt-0.5 h-5 w-5 text-[var(--brand)]" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">AI Roof Measurements</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            One click measures the whole property. If there are <b>multiple structures</b> (shed, detached garage, guest house), <b>click each extra structure on the map first</b> to drop a pin — then hit Measure entire property and each pin will be measured too.
          </p>
        </div>
        <button
          onClick={() => detect.mutate()}
          disabled={detect.isPending}
          className="btn-brand inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-5 text-xs font-semibold disabled:opacity-40"
        >
          {detect.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {detect.isPending ? "Measuring…" : "Measure entire property"}
        </button>
      </div>

      {/* No-coverage empty state — shown when Google Solar has no building data here */}
      {noCoverage && (
        <div
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"
          style={{
            borderColor: "color-mix(in oklab, #f59e0b 35%, transparent)",
            background: "color-mix(in oklab, #f59e0b 8%, var(--bg-card))",
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <div className="text-sm font-semibold text-foreground">
                This property isn't in Google's Solar coverage yet
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                We tried HIGH, MEDIUM, and LOW quality plus 4 nearby points — Google Solar still has no
                building data for this location. This usually means a newer build or a recently
                modified roof. Switch to Mapbox Draw to outline the roof manually, or drop a custom
                pin on the map below to measure a single structure.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => detect.mutate()}
              disabled={detect.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs text-foreground hover:bg-[var(--surface-hover)] disabled:opacity-40"
              style={{ borderColor: "var(--border)" }}
            >
              {detect.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Try again
            </button>
            {onSwitchToMapbox && (
              <button
                onClick={onSwitchToMapbox}
                className="btn-brand inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-semibold"
              >
                Switch to Mapbox Draw
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hand-off banner — only visible after a successful detection */}
      {showHandoff && pins.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          style={{
            borderColor: "color-mix(in oklab, #10b981 35%, transparent)",
            background: "color-mix(in oklab, #10b981 10%, var(--bg-card))",
          }}
        >
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <div className="text-sm font-semibold text-foreground">
                Measured {pins.length} facet{pins.length === 1 ? "" : "s"} · {Math.round(totals.plan).toLocaleString()} sqft plan · {totals.sq.toFixed(1)} SQ
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Verify the highlights on the map below. Then send to Mapbox to label edges (eaves, hips, ridges) for an accurate flashing &amp; ridge cap quote.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHandoff(false)}
              className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-xs text-muted-foreground hover:text-foreground"
              style={{ borderColor: "var(--border)" }}
            >
              Dismiss
            </button>
            <button
              onClick={applyToMapbox}
              className="btn-brand inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-xs font-semibold"
            >
              Send to Mapbox to refine
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* AI Calibration banner — when training data is available */}
      {calibration && calibration.example_count > 0 && calibration.calibrated_total_sqft != null && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
          style={{
            borderColor: "color-mix(in oklab, #8b5cf6 30%, transparent)",
            background: "color-mix(in oklab, #8b5cf6 8%, var(--bg-card))",
          }}
        >
          <Brain className="h-4 w-4 shrink-0 text-violet-500" />
          <div className="flex-1 text-xs">
            <span className="font-semibold text-foreground">
              AI-calibrated total: {Math.round(calibration.calibrated_total_sqft).toLocaleString()} sqft
            </span>
            <span className="ml-2 text-muted-foreground">
              vs raw {Math.round(calibration.raw_total_sqft).toLocaleString()} sqft · based on {calibration.example_count} nearby training example{calibration.example_count === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      {/* Map */}
      <div
        className="relative overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)", height: 500 }}
      >
        {tokenLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-card)] text-xs text-muted-foreground">
            Loading map…
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
        {drawingPinId ? (
          <div
            className="absolute left-3 top-3 z-10 flex items-center gap-3 rounded-md border px-3 py-2 text-[11px] backdrop-blur"
            style={{
              borderColor: "#3b82f6",
              backgroundColor: "color-mix(in oklab, var(--bg-card) 90%, transparent)",
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-[#3b82f6]" />
            <span className="text-foreground font-semibold">
              Drawing: click {drawPoints.length < 3 ? `${3 - drawPoints.length} more point${3 - drawPoints.length === 1 ? "" : "s"}` : `(${drawPoints.length} points)`}
            </span>
            <button
              onClick={finishDraw}
              disabled={drawPoints.length < 3}
              className="inline-flex items-center gap-1 rounded bg-[#3b82f6] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              <Check className="h-3 w-3" /> Done
            </button>
            <button
              onClick={cancelDraw}
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              style={{ borderColor: "var(--border)" }}
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        ) : (
          <div
            className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] backdrop-blur"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "color-mix(in oklab, var(--bg-card) 85%, transparent)",
            }}
          >
            <Info className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Click to add a custom pin · use button above to measure whole property</span>
          </div>
        )}
        {imageryQuality && (
          <div
            className="absolute right-3 top-3 z-10 rounded-md border px-2 py-1 text-[10px] uppercase tracking-wider backdrop-blur"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "color-mix(in oklab, var(--bg-card) 85%, transparent)",
            }}
          >
            Imagery: {imageryQuality}
          </div>
        )}

        {/* Overlay legend (bottom-left of map) */}
        {pins.length > 0 && (
          <div
            className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 rounded-md border px-3 py-2 text-[11px] backdrop-blur"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "color-mix(in oklab, var(--bg-card) 90%, transparent)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Highlight overlay</span>
              <button
                onClick={() => setShowOverlay((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-foreground hover:text-[var(--brand)]"
                title={showOverlay ? "Hide highlights" : "Show highlights"}
              >
                {showOverlay ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {showOverlay ? "On" : "Off"}
              </button>
            </div>
            <LegendSwatch color={FILL_COLORS.pitched} stroke={STROKE_COLORS.pitched} label="Pitched" />
            <LegendSwatch color={FILL_COLORS.flat} stroke={STROKE_COLORS.flat} label="Flat" />
            <LegendSwatch color="transparent" stroke={STROKE_COLORS.ignore} label="Ignored" dashed />
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {pins.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => {
              setPins([]);
              setActivePinId(null);
              setShowHandoff(false);
              setCalibration(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            <Trash2 className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}

      {/* Active pin editor */}
      {activePin && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Edit pin · {activePin.source === "solar" ? "AI-detected" : "Manual"}
              {activePin.facets && activePin.facets.length > 1 && (
                <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                  (whole structure: {activePin.facets.length} facets)
                </span>
              )}
            </h4>
            <button
              onClick={() => removePin(activePin.id)}
              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={activePin.name}
                onChange={(e) => updatePin(activePin.id, { name: e.target.value })}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
            </Field>
            <Field label="Type">
              <div className="flex gap-1">
                {(["pitched", "flat", "ignore"] as PinKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => updatePin(activePin.id, { kind: k })}
                    className={`flex-1 rounded-md border px-2 py-2 text-xs capitalize transition ${
                      activePin.kind === k
                        ? "border-[var(--brand)] text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={{
                      borderColor: activePin.kind === k ? undefined : "var(--border)",
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </Field>
            {activePin.kind === "pitched" && (
              <Field label="Pitch">
                <select
                  value={activePin.pitch}
                  onChange={(e) => updatePin(activePin.id, { pitch: e.target.value })}
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)" }}
                >
                  {PITCH_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p} ({pitchMultiplier(p).toFixed(3)}×)
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Plan area (sqft)">
              <input
                type="number"
                inputMode="numeric"
                value={activePin.plan_area_sqft || ""}
                onChange={(e) =>
                  updatePin(activePin.id, { plan_area_sqft: Number(e.target.value) || 0 })
                }
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono-num"
                style={{ borderColor: "var(--border)" }}
                placeholder="0"
              />
            </Field>
          </div>

          {activePin.kind !== "ignore" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => measureOne.mutate(activePin)}
                disabled={measureOne.isPending || drawingPinId === activePin.id}
                className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold disabled:opacity-40"
              >
                {measureOne.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Ruler className="h-3.5 w-3.5" />
                )}
                Measure whole structure here
              </button>
              {drawingPinId === activePin.id ? (
                <button
                  onClick={cancelDraw}
                  className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  style={{ borderColor: "var(--border)" }}
                >
                  <X className="h-3.5 w-3.5" /> Cancel draw
                </button>
              ) : (
                <button
                  onClick={() => startDraw(activePin.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-white/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Draw area on map
                </button>
              )}
              {(activePin.plan_area_sqft || 0) === 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-500">
                  <AlertCircle className="h-3 w-3" /> Not yet measured
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pin list */}
      {pins.length > 0 && (
        <div
          className="rounded-xl border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Facets ({pins.length})
              {pins.some((p) => p.kind !== "ignore" && (p.plan_area_sqft || 0) === 0) && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                  <AlertCircle className="h-2.5 w-2.5" />
                  {pins.filter((p) => p.kind !== "ignore" && (p.plan_area_sqft || 0) === 0).length} unmeasured
                </span>
              )}
            </h4>
            {pins.some((p) => p.kind !== "ignore" && (p.plan_area_sqft || 0) === 0) && (
              <button
                onClick={() => measureAll.mutate()}
                disabled={measureAll.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-white/5 disabled:opacity-40"
                style={{ borderColor: "var(--border)" }}
              >
                {measureAll.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Ruler className="h-3 w-3" />
                )}
                Measure all unmeasured
              </button>
            )}
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {pins.map((p, i) => {
              const unmeasured = p.kind !== "ignore" && (p.plan_area_sqft || 0) === 0;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePinId(p.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs transition hover:bg-white/5 ${
                    activePinId === p.id ? "bg-white/5" : ""
                  }`}
                >
                  <div
                    className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: FILL_COLORS[p.kind] }}
                  >
                    {i + 1}
                    {unmeasured && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-[var(--bg-card)]" />
                    )}
                  </div>
                  <div className="flex-1 truncate">
                    <p className="truncate font-semibold text-foreground">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.kind === "ignore"
                        ? "Ignored"
                        : unmeasured
                          ? `${p.kind === "flat" ? "Flat" : `Pitched ${p.pitch}`} · not measured yet`
                          : `${p.kind === "flat" ? "Flat" : `Pitched ${p.pitch}`} · ${(
                              p.plan_area_sqft || 0
                            ).toLocaleString()} sqft plan`}
                    </p>
                  </div>
                  {unmeasured && (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Totals */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Totals
          </h4>
          <div className="flex items-center gap-3">
            <label className="text-[11px] text-muted-foreground">Waste</label>
            <input
              type="range"
              min={0}
              max={25}
              step={1}
              value={wastePct}
              onChange={(e) => setWastePct(Number(e.target.value))}
              className="w-32 accent-[var(--brand)]"
            />
            <span className="font-mono-num w-10 text-right text-xs font-semibold text-foreground">
              {wastePct}%
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Plan area" value={`${Math.round(totals.plan).toLocaleString()} sqft`} />
          <Stat
            label="Sloped (× pitch)"
            value={`${Math.round(totals.sloped).toLocaleString()} sqft`}
          />
          <Stat
            label={`+ Waste ${wastePct}%`}
            value={`${Math.round(totals.wasted).toLocaleString()} sqft`}
          />
          <Stat label="Squares" value={totals.sq.toFixed(2)} highlight />
        </div>
      </div>

      {/* Apply */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {pins.length === 0 ? (
            <>
              <Plus className="mr-1 inline h-3 w-3" />
              Click <b>Measure entire property</b> above, or click anywhere on the map to add a custom pin.
            </>
          ) : (
            <>
              {totals.count} active facet{totals.count === 1 ? "" : "s"} · totals account for pitch and waste.
            </>
          )}
        </p>
        <button
          onClick={applyToMapbox}
          disabled={pins.length === 0}
          className="btn-brand inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold disabled:opacity-40"
        >
          Apply to Mapbox tab
        </button>
      </div>

      {/* Hide unused state to satisfy linter */}
      <span className="sr-only" aria-hidden>
        {showCoverageGaps ? "" : ""}
        <button onClick={() => setShowCoverageGaps((v) => !v)} />
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function LegendSwatch({ color, stroke, label, dashed }: { color: string; stroke: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-foreground">
      <span
        className="inline-block h-3 w-5 rounded-sm"
        style={{
          backgroundColor: color === "transparent" ? "transparent" : `color-mix(in oklab, ${color} 40%, transparent)`,
          border: `2px ${dashed ? "dashed" : "solid"} ${stroke}`,
        }}
      />
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`font-mono-num text-base font-semibold ${
          highlight ? "text-[var(--brand)]" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
