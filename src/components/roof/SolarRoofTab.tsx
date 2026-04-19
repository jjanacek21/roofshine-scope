import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Satellite, Sparkles } from "lucide-react";
import type { MapboxRoofData } from "./MapboxRoofDraw";

type SolarSegment = {
  index: number;
  name: string;
  plan_area_sqft: number;
  pitch: string;
  pitch_degrees: number;
  azimuth_degrees: number;
  ring: number[][];
};

const SECTION_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"];

export function SolarRoofTab({
  center,
  onApply,
}: {
  center: { lng: number; lat: number };
  onApply: (data: MapboxRoofData) => void;
}) {
  const [result, setResult] = useState<{
    total_plan_sqft: number;
    segments: SolarSegment[];
    imagery_quality: string | null;
  } | null>(null);

  const extract = useMutation({
    mutationFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const accessToken = s.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const r = await fetch("/api/solar-roof-extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ lat: center.lat, lng: center.lng }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || "Solar API failed");
      }
      return r.json() as Promise<typeof result extends infer T ? NonNullable<T> : never>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Found ${data.segments.length} roof segments`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Solar API failed"),
  });

  function applyToMapbox() {
    if (!result) return;
    const data: MapboxRoofData = {
      sections: result.segments.map((seg, i) => ({
        id: `solar-${i}`,
        name: seg.name,
        color: SECTION_COLORS[i % SECTION_COLORS.length],
        ring: seg.ring,
        plan_area_sqft: seg.plan_area_sqft,
        pitch: seg.pitch,
        edges: seg.ring.length > 1 ? new Array(seg.ring.length - 1).fill(null) : [],
      })),
      lines: [],
    };
    onApply(data);
    toast.success("Applied to Mapbox tab — review & label edges");
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="flex items-start gap-3">
          <Satellite className="mt-0.5 h-5 w-5 text-[var(--brand)]" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Google Solar API</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-detect roof segments, areas, and pitches from Google's satellite imagery. Best
              coverage in US suburbs.
            </p>
          </div>
          <button
            onClick={() => extract.mutate()}
            disabled={extract.isPending}
            className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold disabled:opacity-40"
          >
            {extract.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {extract.isPending ? "Analyzing…" : "Extract Roof"}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total Plan Area" value={`${Math.round(result.total_plan_sqft).toLocaleString()} sqft`} />
            <Stat label="Segments" value={String(result.segments.length)} />
            <Stat label="Imagery" value={result.imagery_quality ?? "—"} />
          </div>

          <div className="space-y-2 max-h-72 overflow-auto">
            {result.segments.map((s) => (
              <div
                key={s.index}
                className="flex items-center justify-between rounded-md border p-2 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="font-semibold text-foreground">{s.name}</p>
                  <p className="text-muted-foreground">
                    {Math.round(s.plan_area_sqft)} sqft · {s.pitch} pitch · {Math.round(s.azimuth_degrees)}° azimuth
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={applyToMapbox}
            className="btn-brand w-full rounded-md py-2 text-xs font-semibold"
          >
            Apply to Mapbox tab
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono-num text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
