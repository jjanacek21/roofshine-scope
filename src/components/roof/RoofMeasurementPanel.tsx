import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Save, Map as MapIcon, FileText, Sparkles, Pencil } from "lucide-react";
import {
  ManualMeasurementForm,
  type ManualValues,
  blankManualValues,
} from "./ManualMeasurementForm";
import { MapboxRoofDraw, type MapboxRoofData } from "./MapboxRoofDraw";
import { SolarRoofTab } from "./SolarRoofTab";
import { ConditionAITab } from "./ConditionAITab";
import {
  squares, withWaste, bundles, lineStringLengthFeet, polygonEdgeLengths,
  type EdgeType,
} from "@/lib/roof-math";

type Tab = "manual" | "mapbox" | "solar" | "condition" | "report";

const TAB_LABELS: Record<Tab, { label: string; icon: typeof MapIcon }> = {
  manual: { label: "Manual Entry", icon: Pencil },
  mapbox: { label: "Mapbox Draw", icon: MapIcon },
  solar: { label: "Google Solar", icon: Sparkles },
  condition: { label: "AI Condition", icon: Sparkles },
  report: { label: "Upload Report", icon: FileText },
};

export function RoofMeasurementPanel({
  propertyId,
  center,
}: {
  propertyId: string;
  center: { lng: number; lat: number } | null;
}) {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(center ? "mapbox" : "manual");

  const { data: existing } = useQuery({
    queryKey: ["roof-measurement", propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("roof_measurements")
        .select("*")
        .eq("property_id", propertyId)
        .maybeSingle();
      return data;
    },
  });

  const [manual, setManual] = useState<ManualValues>(blankManualValues);
  const [mapboxData, setMapboxData] = useState<MapboxRoofData>({ sections: [], lines: [] });

  // Hydrate manual form from existing
  useEffect(() => {
    if (existing) {
      setManual({
        predominant_pitch: existing.predominant_pitch ?? "6/12",
        waste_pct: Number(existing.waste_pct ?? 15),
        total_area_sqft: Number(existing.total_area_sqft ?? 0),
        eaves_lf: Number(existing.eaves_lf ?? 0),
        rakes_lf: Number(existing.rakes_lf ?? 0),
        ridges_lf: Number(existing.ridges_lf ?? 0),
        hips_lf: Number(existing.hips_lf ?? 0),
        valleys_lf: Number(existing.valleys_lf ?? 0),
        gutters_lf: Number(existing.gutters_lf ?? 0),
        wall_flashing_lf: Number(existing.wall_flashing_lf ?? 0),
        step_flashing_lf: Number(existing.step_flashing_lf ?? 0),
        transition_lf: Number(existing.transition_lf ?? 0),
      });
    }
  }, [existing]);

  // Compute totals from Mapbox data when in that tab
  const mapboxTotals = computeMapboxTotals(mapboxData);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      const isMapbox = tab === "mapbox";
      const source = isMapbox ? "mapbox_draw" : "manual";

      const totals = isMapbox ? mapboxTotals : {
        total_area_sqft: manual.total_area_sqft,
        squares: squares(manual.total_area_sqft),
        eaves_lf: manual.eaves_lf,
        rakes_lf: manual.rakes_lf,
        ridges_lf: manual.ridges_lf,
        hips_lf: manual.hips_lf,
        valleys_lf: manual.valleys_lf,
        gutters_lf: manual.gutters_lf,
        wall_flashing_lf: manual.wall_flashing_lf,
        step_flashing_lf: manual.step_flashing_lf,
        transition_lf: manual.transition_lf,
      };

      const payload = {
        property_id: propertyId,
        company_id: profile.company_id,
        source: source as "manual" | "mapbox_draw",
        predominant_pitch: manual.predominant_pitch,
        waste_pct: manual.waste_pct,
        total_area_sqft: totals.total_area_sqft,
        squares: totals.squares,
        eaves_lf: totals.eaves_lf,
        rakes_lf: totals.rakes_lf,
        ridges_lf: totals.ridges_lf,
        hips_lf: totals.hips_lf,
        valleys_lf: totals.valleys_lf,
        gutters_lf: totals.gutters_lf,
        wall_flashing_lf: totals.wall_flashing_lf,
        step_flashing_lf: totals.step_flashing_lf,
        transition_lf: totals.transition_lf,
        created_by: profile.id,
      };

      // Upsert measurement
      const { data: m, error: mErr } = await supabase
        .from("roof_measurements")
        .upsert(payload, { onConflict: "property_id" })
        .select()
        .single();
      if (mErr) throw mErr;

      // If mapbox: replace sections/edges/lines
      if (isMapbox) {
        await supabase.from("roof_sections").delete().eq("measurement_id", m.id);
        await supabase.from("roof_lines").delete().eq("measurement_id", m.id);

        for (let i = 0; i < mapboxData.sections.length; i++) {
          const s = mapboxData.sections[i];
          const planArea = s.plan_area_sqft;
          const mult = pitchMult(s.pitch);
          const actualArea = planArea * mult;
          const { data: secRow, error: secErr } = await supabase
            .from("roof_sections")
            .insert({
              measurement_id: m.id,
              name: s.name,
              color: s.color,
              polygon_geojson: { type: "Polygon", coordinates: [s.ring] },
              plan_area_sqft: planArea,
              pitch: s.pitch,
              pitch_multiplier: mult,
              actual_area_sqft: actualArea,
              sort_order: i,
            })
            .select()
            .single();
          if (secErr) throw secErr;

          const lengths = polygonEdgeLengths(s.ring);
          const edgeRows = s.edges
            .map((e, idx) => e ? { section_id: secRow.id, edge_index: idx, edge_type: e, length_lf: lengths[idx] ?? 0 } : null)
            .filter((x): x is NonNullable<typeof x> => x !== null);
          if (edgeRows.length) {
            const { error: eErr } = await supabase.from("roof_edges").insert(edgeRows);
            if (eErr) throw eErr;
          }
        }

        if (mapboxData.lines.length) {
          const lineRows = mapboxData.lines.map((l) => ({
            measurement_id: m.id,
            line_geojson: { type: "LineString", coordinates: l.coords },
            line_type: l.type,
            length_lf: lineStringLengthFeet(l.coords),
          }));
          const { error: lErr } = await supabase.from("roof_lines").insert(lineRows);
          if (lErr) throw lErr;
        }
      }
    },
    onSuccess: () => {
      toast.success("Roof measurements saved");
      qc.invalidateQueries({ queryKey: ["roof-measurement", propertyId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {(Object.entries(TAB_LABELS) as [Tab, typeof TAB_LABELS[Tab]][]).map(([k, v]) => {
          const Icon = v.icon;
          const disabled = (k === "mapbox" || k === "solar" || k === "condition") && !center;
          return (
            <button
              key={k}
              onClick={() => !disabled && setTab(k)}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${
                tab === k
                  ? "border-[var(--brand)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              title={disabled ? "Property has no coordinates" : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {tab === "manual" && (
        <ManualMeasurementForm values={manual} onChange={setManual} />
      )}
      {tab === "mapbox" && center && (
        <>
          <MapboxRoofDraw center={center} onChange={setMapboxData} />
          <div className="grid grid-cols-3 gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <Stat label="Total Squares" value={squares(mapboxTotals.total_area_sqft).toFixed(2)} />
            <Stat label={`+ ${manual.waste_pct}% waste`} value={squares(withWaste(mapboxTotals.total_area_sqft, manual.waste_pct)).toFixed(2)} />
            <Stat label="Bundles" value={bundles(mapboxTotals.total_area_sqft, manual.waste_pct).toString()} />
          </div>
        </>
      )}
      {tab === "solar" && center && (
        <SolarRoofTab center={center} onApply={(d) => { setMapboxData(d); setTab("mapbox"); }} />
      )}
      {tab === "solar" && !center && (
        <div className="rounded-xl border p-12 text-center text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
          Property has no coordinates — add an address first.
        </div>
      )}
      {tab === "condition" && (
        <ConditionAITab
          propertyId={propertyId}
          center={center}
          initial={existing?.ai_analysis as Record<string, unknown> | undefined}
        />
      )}
      {tab === "report" && (
        <div className="rounded-xl border p-12 text-center text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
          Third-party report PDF upload (EagleView, Hover) — coming in Round C.
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-brand inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "Saving…" : "Save Measurements"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono-num text-2xl text-foreground">{value}</p>
    </div>
  );
}

type EdgeKey =
  | "eaves_lf" | "rakes_lf" | "ridges_lf" | "hips_lf" | "valleys_lf"
  | "gutters_lf" | "wall_flashing_lf" | "step_flashing_lf" | "transition_lf";

const EDGE_KEY_MAP: Record<EdgeType, EdgeKey> = {
  eave: "eaves_lf",
  rake: "rakes_lf",
  ridge: "ridges_lf",
  hip: "hips_lf",
  valley: "valleys_lf",
  gutter: "gutters_lf",
  wall_flashing: "wall_flashing_lf",
  step_flashing: "step_flashing_lf",
  transition: "transition_lf",
};

function computeMapboxTotals(data: MapboxRoofData) {
  const totals: Record<EdgeKey, number> = {
    eaves_lf: 0, rakes_lf: 0, ridges_lf: 0, hips_lf: 0, valleys_lf: 0,
    gutters_lf: 0, wall_flashing_lf: 0, step_flashing_lf: 0, transition_lf: 0,
  };
  let total_area_sqft = 0;
  // sections — include actual area (with pitch) and edge contributions
  for (const s of data.sections) {
    const lengths = polygonEdgeLengths(s.ring);
    // actual area uses pitch multiplier from roof-math (recomputed here for safety)
    const actualArea = s.plan_area_sqft * pitchMult(s.pitch);
    total_area_sqft += actualArea;
    s.edges.forEach((e, i) => {
      if (e) totals[EDGE_KEY_MAP[e]] += lengths[i] ?? 0;
    });
  }
  // free lines
  for (const l of data.lines) {
    totals[EDGE_KEY_MAP[l.type]] += lineStringLengthFeet(l.coords);
  }
  return {
    total_area_sqft,
    squares: squares(total_area_sqft),
    ...totals,
  };
}

function pitchMult(pitch: string): number {
  const m = pitch.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return 1;
  const rise = Number(m[1]);
  const run = Number(m[2]);
  if (run === 0) return 1;
  return Math.sqrt(1 + (rise / run) ** 2);
}
