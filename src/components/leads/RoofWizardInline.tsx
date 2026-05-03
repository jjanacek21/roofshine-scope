import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, MapPin, Loader2, RotateCcw, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { fmtNum, type LeadRow } from "@/lib/leads";
import { analyzeRoofWithAI } from "@/server/lead-ai.functions";
import { supabase } from "@/integrations/supabase/client";

interface Pin { id: string; lat: number; lng: number; }
interface Measurements {
  total_sqft: number;
  sun_hours_per_year: number;
  avg_pitch: number;
  segments: { pitch: number; azimuth: number; area_sqft: number }[];
}
type PinStatus = Record<string, { status: "pending" | "ok" | "error"; sqft?: number; message?: string }>;

interface Props {
  lead: LeadRow;
}

export function RoofWizardInline({ lead }: Props) {
  const { data: token } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeRoofWithAI);

  const savedReport = (lead.ai_report ?? {}) as {
    measurements?: Measurements & { pins?: { lat: number; lng: number }[] };
    analysis?: string;
  };

  const [pins, setPins] = useState<Pin[]>(
    (savedReport.measurements?.pins ?? []).map((p) => ({ id: crypto.randomUUID(), lat: p.lat, lng: p.lng })),
  );
  const [pinStatus, setPinStatus] = useState<PinStatus>({});
  const [measurements, setMeasurements] = useState<Measurements | null>(savedReport.measurements ?? null);
  const [analysis, setAnalysis] = useState<string>(savedReport.analysis ?? "");
  const [loading, setLoading] = useState<"none" | "measure" | "analyze">("none");

  const center = useMemo(() => {
    if (pins.length > 0) {
      return {
        lat: pins.reduce((a, p) => a + p.lat, 0) / pins.length,
        lng: pins.reduce((a, p) => a + p.lng, 0) / pins.length,
      };
    }
    if (lead.lat != null && lead.lng != null) return { lat: lead.lat, lng: lead.lng };
    return null;
  }, [pins, lead.lat, lead.lng]);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    if (lead.lat == null || lead.lng == null) return;
    mapboxgl.accessToken = token;
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [lead.lng, lead.lat],
        zoom: 19,
        maxZoom: 20,
        attributionControl: false,
      });
    } catch (err) {
      console.error("Mapbox init failed", err);
      return;
    }
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (e) => console.warn("Mapbox event error:", e?.error?.message ?? e));
    map.on("click", (e) => {
      setPins((prev) => [...prev, { id: crypto.randomUUID(), lat: e.lngLat.lat, lng: e.lngLat.lng }]);
    });
    const t = setTimeout(() => map.resize(), 250);
    mapRef.current = map;
    return () => {
      clearTimeout(t);
      try { map.remove(); } catch { /* noop */ }
      mapRef.current = null;
    };
  }, [token, lead.lat, lead.lng]);

  // Render pin markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    pins.forEach((p, i) => {
      const el = document.createElement("div");
      el.style.cssText = `width:24px;height:24px;border-radius:50%;border:2px solid #fff;background:#3b82f6;box-shadow:0 2px 6px rgba(0,0,0,.5);display:grid;place-items:center;color:#fff;font:600 11px system-ui;cursor:pointer;`;
      el.textContent = String(i + 1);
      el.onclick = (ev) => {
        ev.stopPropagation();
        setPins((prev) => prev.filter((x) => x.id !== p.id));
        setPinStatus((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
      };
      const m = new mapboxgl.Marker(el).setLngLat([p.lng, p.lat]).addTo(mapRef.current!);
      markersRef.current.push(m);
    });
  }, [pins]);

  async function runMeasurements() {
    if (!center) {
      toast.error("Drop at least one pin first.");
      return;
    }
    setLoading("measure");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Please sign in again.");

      const targets = pins.length > 0 ? pins : [{ id: "selected", lat: center.lat, lng: center.lng }];
      const results: Measurements[] = [];
      const failures: string[] = [];
      const nextStatus: PinStatus = {};
      targets.forEach((t) => { nextStatus[t.id] = { status: "pending" }; });
      setPinStatus(nextStatus);

      for (const target of targets) {
        const response = await fetch("/api/solar-roof-extract", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ lat: target.lat, lng: target.lng, property_id: lead.id }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = String(payload.message ?? payload.detail ?? payload.error ?? "Pin failed");
          failures.push(msg);
          setPinStatus((prev) => ({ ...prev, [target.id]: { status: "error", message: msg } }));
          continue;
        }
        const segments = ((payload.segments ?? []) as Array<{ pitch_degrees?: number; azimuth_degrees?: number; plan_area_sqft?: number }>).map((s) => ({
          pitch: Number(s.pitch_degrees ?? 0),
          azimuth: Number(s.azimuth_degrees ?? 0),
          area_sqft: Number(s.plan_area_sqft ?? 0),
        }));
        const avgPitch = segments.length > 0 ? segments.reduce((a, s) => a + s.pitch, 0) / segments.length : 0;
        const totalSqft = Number(payload.total_plan_sqft ?? 0);
        results.push({
          total_sqft: totalSqft,
          sun_hours_per_year: Number(payload.max_sunshine_hours_per_year ?? 0),
          avg_pitch: avgPitch,
          segments,
        });
        setPinStatus((prev) => ({ ...prev, [target.id]: { status: "ok", sqft: totalSqft } }));
      }

      if (results.length === 0) {
        toast.error(failures[0] ?? "No roof data returned.");
        return;
      }
      const allSegments = results.flatMap((r) => r.segments);
      const merged: Measurements = {
        total_sqft: results.reduce((s, r) => s + r.total_sqft, 0),
        sun_hours_per_year: Math.max(...results.map((r) => r.sun_hours_per_year)),
        avg_pitch: allSegments.length > 0 ? allSegments.reduce((a, s) => a + s.pitch, 0) / allSegments.length : 0,
        segments: allSegments,
      };
      setMeasurements(merged);

      const prev = (lead.ai_report as Record<string, unknown> | null) ?? {};
      await supabase.from("leads").update({
        ai_report: {
          ...prev,
          measurements: {
            total_sqft: Math.round(merged.total_sqft),
            sun_hours_per_year: Math.round(merged.sun_hours_per_year),
            avg_pitch: Number(merged.avg_pitch.toFixed(2)),
            segment_count: merged.segments.length,
            pins: pins.map((p) => ({ lat: p.lat, lng: p.lng })),
            generated_at: new Date().toISOString(),
          },
        },
        sqft: Math.round(merged.total_sqft) || undefined,
      }).eq("id", lead.id);
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`Measurements ready (${fmtNum(Math.round(merged.total_sqft))} sqft)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to measure");
    } finally {
      setLoading("none");
    }
  }

  async function runAnalysis() {
    const target = center ?? (lead.lat != null && lead.lng != null ? { lat: lead.lat, lng: lead.lng } : null);
    if (!target) { toast.error("Lead has no coordinates"); return; }
    setLoading("analyze");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const res = await analyze({
        data: {
          lat: target.lat,
          lng: target.lng,
          address: lead.address,
          pinCount: Math.max(1, pins.length),
          leadId: lead.id,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnalysis(res.analysis);
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("AI analysis complete");
    } catch (e) {
      let msg = e instanceof Error ? e.message : "Failed to analyze";
      if (e instanceof Response) msg = (await e.text().catch(() => "")) || `Server error ${e.status}`;
      toast.error(msg);
    } finally {
      setLoading("none");
    }
  }

  function openReportBuilder() {
    navigate({ to: "/leads/savings", search: { leadId: lead.id } });
  }

  if (lead.lat == null || lead.lng == null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
        No coordinates — geocoding…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="h-[320px] w-full overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--border)" }}
      />
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MapPin className="h-3 w-3" />
        Click roofs to drop pins · click a pin to remove it · drag/zoom freely.
      </p>

      {pins.length > 0 && (
        <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pins ({pins.length})</span>
            <button
              type="button"
              onClick={() => { setPins([]); setPinStatus({}); }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>
          <ul className="space-y-1 text-xs">
            {pins.map((p, i) => {
              const st = pinStatus[p.id];
              const dot = st?.status === "ok" ? "bg-emerald-500"
                : st?.status === "error" ? "bg-red-500"
                : st?.status === "pending" ? "bg-amber-400 animate-pulse"
                : "bg-[var(--border)]";
              const label = st?.status === "ok" ? `${fmtNum(Math.round(st.sqft ?? 0))} sqft`
                : st?.status === "error" ? "Error"
                : st?.status === "pending" ? "Measuring…"
                : "Not measured";
              return (
                <li key={p.id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                  <span className="font-mono-num">#{i + 1}</span>
                  <span className="ml-auto text-muted-foreground">{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {measurements && (
        <div className="grid grid-cols-2 gap-2">
          <Mini k="Roof area" v={`${fmtNum(Math.round(measurements.total_sqft))} sqft`} />
          <Mini k="Avg pitch" v={`${measurements.avg_pitch.toFixed(1)}°`} />
          <Mini k="Sun hrs/yr" v={fmtNum(Math.round(measurements.sun_hours_per_year))} />
          <Mini k="Segments" v={String(measurements.segments.length)} />
        </div>
      )}

      {analysis && (
        <div className="rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)", whiteSpace: "pre-wrap" }}>
          {analysis}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={runMeasurements}
          disabled={loading !== "none" || pins.length === 0}
          className="flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        >
          {loading === "measure" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          Get measurements
        </button>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={loading !== "none"}
          className="flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
        >
          {loading === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Run analysis & generate report
        </button>
      </div>
      {(measurements || analysis) && (
        <button
          type="button"
          onClick={openReportBuilder}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <FileDown className="h-3.5 w-3.5" />
          Open report builder
        </button>
      )}
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono-num text-sm font-medium text-foreground">{v}</div>
    </div>
  );
}
