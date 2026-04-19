import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { toast } from "sonner";
import { Loader2, Satellite, Sparkles, Trash2, Plus, Info, Ruler, Pencil, AlertCircle, Check } from "lucide-react";
import type { MapboxRoofData } from "./MapboxRoofDraw";
import { PITCH_OPTIONS, pitchMultiplier, withWaste, squares, polygonAreaSqft } from "@/lib/roof-math";
import "mapbox-gl/dist/mapbox-gl.css";

type PinKind = "pitched" | "flat" | "ignore";

type Pin = {
  id: string;
  name: string;
  kind: PinKind;
  pitch: string; // e.g. "6/12"; ignored when kind === "flat"
  plan_area_sqft: number;
  lng: number;
  lat: number;
  ring?: number[][]; // optional polygon (from Solar API bbox)
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

const KIND_COLORS: Record<PinKind, string> = {
  pitched: "#3b82f6", // blue
  flat: "#06b6d4", // cyan
  ignore: "#9ca3af", // gray
};

const SECTION_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Build a small ~20ft square ring centered on a coordinate. */
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

export function SolarRoofTab({
  center,
  onApply,
}: {
  center: { lng: number; lat: number };
  onApply: (data: MapboxRoofData) => void;
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

  // Keep ref synced for marker click handlers
  useEffect(() => {
    pinsStateRef.current = pins;
  }, [pins]);

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
      // Ignore clicks on existing markers (mapbox handles those separately)
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

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, center.lng, center.lat]);

  // Sync markers with pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markersRef.current;
    const seen = new Set<string>();

    pins.forEach((pin, i) => {
      seen.add(pin.id);
      const color = KIND_COLORS[pin.kind];
      let marker = existing[pin.id];
      if (!marker) {
        const el = document.createElement("div");
        el.style.cssText = `width:28px;height:28px;border-radius:50%;background:${color};color:white;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;`;
        el.textContent = String(i + 1);
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setActivePinId(pin.id);
        });
        marker = new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
        existing[pin.id] = marker;
      } else {
        const el = marker.getElement();
        el.style.background = color;
        el.textContent = String(i + 1);
        marker.setLngLat([pin.lng, pin.lat]);
      }
    });

    // Remove markers no longer in pins
    Object.keys(existing).forEach((id) => {
      if (!seen.has(id)) {
        existing[id].remove();
        delete existing[id];
      }
    });
  }, [pins]);

  const detect = useMutation({
    mutationFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const accessToken = s.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const r = await fetch("/api/solar-roof-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ lat: center.lat, lng: center.lng }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || "Solar API failed");
      }
      return (await r.json()) as SolarResponse;
    },
    onSuccess: (data) => {
      setImageryQuality(data.imagery_quality);
      const newPins: Pin[] = data.segments.map((seg, i) => {
        const c = seg.center
          ? { lng: seg.center.longitude, lat: seg.center.latitude }
          : seg.ring.length
            ? { lng: seg.ring[0][0], lat: seg.ring[0][1] }
            : center;
        return {
          id: rid(),
          name: i === 0 ? "Main roof" : `Structure ${i + 1}`,
          kind: "pitched" as const,
          pitch: seg.pitch || "6/12",
          plan_area_sqft: Math.round(seg.plan_area_sqft),
          lng: c.lng,
          lat: c.lat,
          ring: seg.ring,
          source: "solar" as const,
        };
      });
      setPins(newPins);
      setActivePinId(newPins[0]?.id ?? null);
      toast.success(`Detected ${newPins.length} structure${newPins.length === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Detection failed"),
  });

  function updatePin(id: string, patch: Partial<Pin>) {
    setPins((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removePin(id: string) {
    setPins((p) => p.filter((x) => x.id !== id));
    if (activePinId === id) setActivePinId(null);
  }

  const totals = useMemo(() => {
    const active = pins.filter((p) => p.kind !== "ignore");
    const plan = active.reduce((s, p) => s + (p.plan_area_sqft || 0), 0);
    const sloped = active.reduce((s, p) => {
      const mult = p.kind === "flat" ? 1 : pitchMultiplier(p.pitch);
      return s + (p.plan_area_sqft || 0) * mult;
    }, 0);
    const wasted = withWaste(sloped, wastePct);
    return {
      plan,
      sloped,
      wasted,
      sq: squares(wasted),
      count: active.length,
    };
  }, [pins, wastePct]);

  function applyToMapbox() {
    const active = pins.filter((p) => p.kind !== "ignore");
    if (active.length === 0) {
      toast.error("Add at least one pin first");
      return;
    }
    const data: MapboxRoofData = {
      sections: active.map((p, i) => {
        const ring = p.ring && p.ring.length >= 3 ? p.ring : squareRingAround(p.lng, p.lat);
        return {
          id: `ai-${p.id}`,
          name: p.name,
          color: SECTION_COLORS[i % SECTION_COLORS.length],
          ring,
          plan_area_sqft: p.plan_area_sqft,
          pitch: p.kind === "flat" ? "0/12" : p.pitch,
          edges: ring.length > 1 ? Array.from({ length: ring.length - 1 }, () => null) : [],
        };
      }),
      lines: [],
    };
    onApply(data);
    toast.success("Applied to Mapbox tab — refine shapes & label edges");
  }

  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="flex items-start gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <Satellite className="mt-0.5 h-5 w-5 text-[var(--brand)]" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">AI Measurements</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Auto-detect roof structures with satellite AI, then drop pins on pitched roof, flat
            roof, or any extra structures. Pitch &amp; waste factors are applied automatically.
          </p>
        </div>
        <button
          onClick={() => detect.mutate()}
          disabled={detect.isPending}
          className="btn-brand inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-4 text-xs font-semibold disabled:opacity-40"
        >
          {detect.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {detect.isPending ? "Detecting…" : "Detect Structures"}
        </button>
      </div>

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
        <div
          className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] backdrop-blur"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "color-mix(in oklab, var(--bg-card) 85%, transparent)",
          }}
        >
          <Info className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Click map to drop a pin on any structure</span>
        </div>
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
      </div>

      {/* Legend + bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <LegendDot color={KIND_COLORS.pitched} label="Pitched" />
          <LegendDot color={KIND_COLORS.flat} label="Flat" />
          <LegendDot color={KIND_COLORS.ignore} label="Ignored" />
        </div>
        {pins.length > 0 && (
          <button
            onClick={() => {
              setPins([]);
              setActivePinId(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            <Trash2 className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      {/* Active pin editor */}
      {activePin && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Edit pin · {activePin.source === "solar" ? "AI-detected" : "Manual"}
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
        </div>
      )}

      {/* Pin list */}
      {pins.length > 0 && (
        <div
          className="rounded-xl border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pins ({pins.length})
            </h4>
            <span className="text-[11px] text-muted-foreground">Click a pin to edit</span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {pins.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setActivePinId(p.id)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs transition hover:bg-white/5 ${
                  activePinId === p.id ? "bg-white/5" : ""
                }`}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: KIND_COLORS[p.kind] }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 truncate">
                  <p className="truncate font-semibold text-foreground">{p.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.kind === "ignore"
                      ? "Ignored"
                      : `${p.kind === "flat" ? "Flat" : `Pitched ${p.pitch}`} · ${(
                          p.plan_area_sqft || 0
                        ).toLocaleString()} sqft plan`}
                  </p>
                </div>
              </button>
            ))}
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
              Click <b>Detect Structures</b> or click anywhere on the map to add a pin.
            </>
          ) : (
            <>
              {totals.count} active pin{totals.count === 1 ? "" : "s"} · totals account for pitch
              and waste.
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
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
