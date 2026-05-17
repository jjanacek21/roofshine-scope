import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Save, Map as MapIcon, FileText, Sparkles, Pencil, CheckCircle2, ArrowRight } from "lucide-react";
import type { Feature, Polygon, LineString, Point } from "geojson";
import {
  ManualMeasurementForm,
  type ManualValues,
  blankManualValues,
} from "./ManualMeasurementForm";
import { MapboxRoofDraw, type MapboxRoofData, type AnyFeature } from "./MapboxRoofDraw";
import { SolarRoofTab } from "./SolarRoofTab";
import { ConditionAITab } from "./ConditionAITab";
import {
  squares, polygonEdgeLengths,
  type EdgeType,
} from "@/lib/roof-math";
import type { FeatureProps } from "@/lib/measurement-utils";

type Tab = "manual" | "mapbox" | "solar" | "condition" | "report";

const TAB_LABELS: Record<Tab, { label: string; icon: typeof MapIcon }> = {
  manual: { label: "Manual Entry", icon: Pencil },
  mapbox: { label: "Mapbox Draw", icon: MapIcon },
  solar: { label: "AI Measurements", icon: Sparkles },
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

  // Load saved sections + lines for hydration into Mapbox draw
  const { data: savedShapes } = useQuery({
    queryKey: ["roof-shapes", existing?.id],
    enabled: !!existing?.id,
    queryFn: async () => {
      const [sections, lines] = await Promise.all([
        supabase.from("roof_sections").select("*, roof_edges(*)").eq("measurement_id", existing!.id),
        supabase.from("roof_lines").select("*").eq("measurement_id", existing!.id),
      ]);
      return { sections: sections.data ?? [], lines: lines.data ?? [] };
    },
  });

  const initialFeatures = useMemo<AnyFeature[]>(() => {
    if (!savedShapes) return [];
    const feats: AnyFeature[] = [];
    for (const s of savedShapes.sections) {
      const geo = s.polygon_geojson as { type: string; coordinates: number[][][] } | null;
      if (!geo?.coordinates) continue;
      feats.push({
        type: "Feature",
        id: `sec-${s.id}`,
        geometry: { type: "Polygon", coordinates: geo.coordinates } as Polygon,
        properties: {
          pitch: s.pitch ?? "6/12",
          section_name: s.name ?? undefined,
          section_color: s.color ?? undefined,
        } as FeatureProps,
      } as Feature<Polygon, FeatureProps>);
    }
    for (const l of savedShapes.lines) {
      const geo = l.line_geojson as { type: string; coordinates: number[][] } | null;
      if (!geo?.coordinates) continue;
      feats.push({
        type: "Feature",
        id: `line-${l.id}`,
        geometry: { type: "LineString", coordinates: geo.coordinates } as LineString,
        properties: { edge_type: l.line_type as EdgeType } as FeatureProps,
      } as Feature<LineString, FeatureProps>);
    }
    return feats;
  }, [savedShapes]);

  const [manual, setManual] = useState<ManualValues>(blankManualValues);
  const [mapboxData, setMapboxData] = useState<MapboxRoofData>({ sections: [], lines: [] });
  const [wastePct, setWastePct] = useState<number>(15);

  // Hydrate manual form + waste from existing
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
      setWastePct(Number(existing.waste_pct ?? 15));
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      const isMapbox = tab === "mapbox";
      const source = isMapbox ? "mapbox_draw" : "manual";

      const totals = isMapbox
        ? mapboxTotalsFromFeatures(mapboxData.features ?? [])
        : {
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
            parapet_wall_lf: 0,
            drip_edge_lf: 0,
          };

      const payload = {
        property_id: propertyId,
        company_id: profile.company_id,
        source: source as "manual" | "mapbox_draw",
        predominant_pitch: manual.predominant_pitch,
        waste_pct: isMapbox ? wastePct : manual.waste_pct,
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
        parapet_wall_lf: totals.parapet_wall_lf,
        drip_edge_lf: totals.drip_edge_lf,
        created_by: profile.id,
      };

      const { data: m, error: mErr } = await supabase
        .from("roof_measurements")
        .upsert(payload, { onConflict: "property_id" })
        .select()
        .single();
      if (mErr) throw mErr;

      if (isMapbox) {
        await supabase.from("roof_sections").delete().eq("measurement_id", m.id);
        await supabase.from("roof_lines").delete().eq("measurement_id", m.id);

        const features = mapboxData.features ?? [];
        const polygons = features.filter(
          (f): f is Feature<Polygon, FeatureProps> => f.geometry.type === "Polygon",
        );
        const lines = features.filter(
          (f): f is Feature<LineString, FeatureProps> => f.geometry.type === "LineString",
        );

        for (let i = 0; i < polygons.length; i++) {
          const poly = polygons[i];
          const ring = poly.geometry.coordinates[0];
          const pitch = poly.properties?.pitch ?? "6/12";
          const mult = pitchMult(pitch);
          const planArea = polygonAreaFromRing(ring);
          const actualArea = planArea * mult;
          const sectionName = poly.properties?.section_name ?? `Roof ${i + 1}`;
          const sectionColor = poly.properties?.section_color ?? "#1e90ff";
          const { error: secErr } = await supabase
            .from("roof_sections")
            .insert({
              measurement_id: m.id,
              name: sectionName,
              color: sectionColor,
              polygon_geojson: { type: "Polygon", coordinates: poly.geometry.coordinates },
              plan_area_sqft: planArea,
              pitch,
              pitch_multiplier: mult,
              actual_area_sqft: actualArea,
              sort_order: i,
            })
            .select()
            .single();
          if (secErr) throw secErr;
        }

        if (lines.length) {
          const lineRows = lines
            .filter((l) => l.properties?.edge_type)
            .map((l) => {
              const lengths = polygonEdgeLengths([
                ...l.geometry.coordinates,
                l.geometry.coordinates[0],
              ]);
              return {
                measurement_id: m.id,
                line_geojson: { type: "LineString", coordinates: l.geometry.coordinates },
                line_type: l.properties!.edge_type as EdgeType,
                is_perimeter: Boolean(l.properties?.is_perimeter),
                length_lf: lengths.reduce((s, n) => s + n, 0),
              };
            });
          if (lineRows.length) {
            const { error: lErr } = await supabase.from("roof_lines").insert(lineRows);
            if (lErr) throw lErr;
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Roof measurements saved");
      qc.invalidateQueries({ queryKey: ["roof-measurement", propertyId] });
      qc.invalidateQueries({ queryKey: ["roof-shapes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const params = useParams({ strict: false }) as { id?: string };
  const jobId = params.id;

  const sourceLabel: Record<string, string> = {
    manual: "Manual Entry",
    mapbox_draw: "Mapbox Draw",
    google_solar: "Google Solar AI",
    third_party_report: "Third-Party Report",
    photo_ai: "Photo AI",
  };

  const updatedAgo = (() => {
    if (!existing?.updated_at) return null;
    const d = new Date(existing.updated_at);
    const sec = Math.round((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)} hr ago`;
    return d.toLocaleDateString();
  })();

  return (
    <div className="space-y-4">
      {existing && Number(existing.total_area_sqft ?? 0) > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          style={{
            borderColor: "color-mix(in oklab, var(--success, #10b981) 30%, transparent)",
            background: "color-mix(in oklab, var(--success, #10b981) 8%, var(--bg-card))",
          }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--success, #10b981)" }} />
            <div>
              <div className="text-sm font-semibold text-foreground">
                Saved measurement{updatedAgo ? ` · updated ${updatedAgo}` : ""}
              </div>
              <div className="mt-0.5 font-mono-num text-[13px] text-foreground">
                {Number(existing.squares ?? 0).toFixed(1)} SQ ·{" "}
                {Number(existing.total_area_sqft ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} SF ·{" "}
                {existing.predominant_pitch ?? "—"} pitch · {Number(existing.waste_pct ?? 15)}% waste
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Source: {sourceLabel[existing.source as string] ?? existing.source}
              </div>
            </div>
          </div>
          {jobId && (
            <Link
              to="/jobs/$id/report"
              params={{ id: jobId }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
              style={{ borderColor: "var(--border)" }}
            >
              View in Report
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

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
              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              title={disabled ? "Property has no coordinates" : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {v.label}
            </button>
          );
        })}
      </div>

      {tab === "manual" && (
        <>
          <ManualMeasurementForm values={manual} onChange={setManual} />
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
        </>
      )}
      {tab === "mapbox" && center && (
        <MapboxRoofDraw
          center={center}
          initialFeatures={initialFeatures}
          onChange={setMapboxData}
          wastePct={wastePct}
          onWasteChange={setWastePct}
          onSave={() => save.mutate()}
          isSaving={save.isPending}
        />
      )}
      {tab === "solar" && center && (
        <SolarRoofTab
          center={center}
          propertyId={propertyId}
          onApply={(d) => { setMapboxData(d); setTab("mapbox"); }}
          onSwitchToMapbox={() => setTab("mapbox")}
        />
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
    </div>
  );
}

type EdgeKey =
  | "eaves_lf" | "rakes_lf" | "ridges_lf" | "hips_lf" | "valleys_lf"
  | "gutters_lf" | "wall_flashing_lf" | "step_flashing_lf" | "transition_lf"
  | "parapet_wall_lf" | "drip_edge_lf";

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
  parapet_wall: "parapet_wall_lf",
  drip_edge: "drip_edge_lf",
};

function mapboxTotalsFromFeatures(features: AnyFeature[]) {
  const totals: Record<EdgeKey, number> = {
    eaves_lf: 0, rakes_lf: 0, ridges_lf: 0, hips_lf: 0, valleys_lf: 0,
    gutters_lf: 0, wall_flashing_lf: 0, step_flashing_lf: 0, transition_lf: 0,
    parapet_wall_lf: 0, drip_edge_lf: 0,
  };
  let total_area_sqft = 0;
  for (const f of features) {
    if (f.geometry.type === "Polygon") {
      const ring = (f as Feature<Polygon, FeatureProps>).geometry.coordinates[0];
      const pitch = (f as Feature<Polygon, FeatureProps>).properties?.pitch ?? "6/12";
      total_area_sqft += polygonAreaFromRing(ring) * pitchMult(pitch);
      // Per-segment perimeter labels feed eaves/rakes (and gutters via eave).
      const labels = ((f as Feature<Polygon, FeatureProps>).properties?.perimeter_edges ?? []) as (EdgeType | null)[];
      for (let i = 0; i < ring.length - 1; i++) {
        const t = labels[i];
        if (!t) continue;
        const lens = polygonEdgeLengths([ring[i], ring[i + 1], ring[i]]);
        const lf = lens[0] ?? 0;
        totals[EDGE_KEY_MAP[t]] += lf;
        if (t === "eave") totals.gutters_lf += lf;
      }
    } else if (f.geometry.type === "LineString") {
      const t = (f as Feature<LineString, FeatureProps>).properties?.edge_type as EdgeType | undefined;
      if (!t) continue;
      const coords = (f as Feature<LineString, FeatureProps>).geometry.coordinates;
      const lens = polygonEdgeLengths([...coords, coords[0]]);
      // Subtract the closing leg which polygonEdgeLengths added
      const len = lens.slice(0, -1).reduce((s, n) => s + n, 0);
      totals[EDGE_KEY_MAP[t]] += len;
    } else if (f.geometry.type === "Point") {
      // Penetrations don't contribute to LF totals.
      void (f as Feature<Point, FeatureProps>);
    }
  }
  return { total_area_sqft, squares: total_area_sqft / 100, ...totals };
}

function polygonAreaFromRing(ring: number[][]): number {
  // Equirectangular shoelace, returns sqft. Mirrors lib/roof-math but local
  // to avoid an extra import cycle.
  if (ring.length < 3) return 0;
  const closed =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring
      : [...ring, ring[0]];
  const lat0 = (closed[0][1] * Math.PI) / 180;
  const cosLat = Math.cos(lat0);
  const ftPerDegLat = 364320;
  const ftPerDegLng = ftPerDegLat * cosLat;
  const pts = closed.map(([lng, lat]) => ({
    x: (lng - closed[0][0]) * ftPerDegLng,
    y: (lat - closed[0][1]) * ftPerDegLat,
  }));
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    s += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
  }
  return Math.abs(s) / 2;
}

function pitchMult(pitch: string): number {
  const m = pitch.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return 1;
  const rise = Number(m[1]);
  const run = Number(m[2]);
  if (run === 0) return 1;
  return Math.sqrt(1 + (rise / run) ** 2);
}
