import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Ruler, AlertTriangle, RefreshCw } from "lucide-react";
import type mapboxgl from "mapbox-gl";
import { supabase } from "@/integrations/supabase/client";
import { autoMeasurePropertyRoof } from "@/lib/auto-measure.functions";
import { ensureStormProperty } from "@/lib/storm-mailer.functions";
import { roofMathFromPlan, PITCH_FACTOR, WASTE_FACTOR, type RoofMath } from "@/lib/storm-config";
import {
  FootprintOverlayEditor,
  type EditableFootprint,
} from "@/components/roof/FootprintOverlayEditor";
import { polygonAreaSqft } from "@/lib/roof-math";

const EPS = 0.00008; // ~9 m box for matching a clicked roof to a saved property

export type MeasureSnapshot = {
  propertyId: string | null;
  roofType: string | null;
  math: RoofMath | null;
  /** true when plan area had to be derived from a pitch-adjusted total */
  planEstimated: boolean;
};

type Props = {
  lat: number;
  lng: number;
  address: string | null;
  /** Footprint bbox of the clicked house: [minLng, minLat, maxLng, maxLat]. */
  footprint?: [number, number, number, number] | null;
  onChange: (snap: MeasureSnapshot) => void;
  onSections: (features: any[]) => void;
  map: mapboxgl.Map | null;
};

const fmt = (n: number) => Math.round(n).toLocaleString();

export function RoofMeasureCard({
  lat,
  lng,
  address,
  footprint = null,
  onChange,
  onSections,
  map,
}: Props) {
  const qc = useQueryClient();
  const key = ["storm-roof", lat.toFixed(5), lng.toFixed(5)];

  const measureFn = useServerFn(autoMeasurePropertyRoof);
  const ensureFn = useServerFn(ensureStormProperty);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: key,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: prop } = await supabase
        .from("properties")
        .select("id, roof_type")
        .gte("lat", lat - EPS)
        .lte("lat", lat + EPS)
        .gte("lng", lng - EPS)
        .lte("lng", lng + EPS)
        .limit(1)
        .maybeSingle();
      if (!prop) return { property: null, measurement: null, sections: [] as any[] };

      const { data: m } = await supabase
        .from("roof_measurements")
        .select("id, total_area_sqft, squares, predominant_pitch")
        .eq("property_id", prop.id)
        .maybeSingle();
      if (!m) return { property: prop, measurement: null, sections: [] as any[] };

      const { data: sections } = await supabase
        .from("roof_sections")
        .select("id, name, color, plan_area_sqft, polygon_geojson")
        .eq("measurement_id", m.id)
        .order("sort_order");

      return { property: prop, measurement: m, sections: sections ?? [] };
    },
  });

  const planSqft = (data?.sections ?? []).reduce(
    (sum: number, s: any) => sum + Number(s.plan_area_sqft ?? 0),
    0,
  );
  const planEstimated = planSqft <= 0 && !!data?.measurement;
  const math = data?.measurement ? (planSqft > 0 ? roofMathFromPlan(planSqft) : null) : null;
  const editableFootprints: EditableFootprint[] = (data?.sections ?? []).flatMap((section: any) => {
    const ring = section.polygon_geojson?.coordinates?.[0];
    return Array.isArray(ring) && ring.length >= 3
      ? [{ id: section.id, ring, originalRing: ring }]
      : [];
  });

  const updateEditableFootprints = (next: EditableFootprint[]) => {
    onSections(
      next.map((item) => ({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [item.ring] },
        properties: { id: item.id, color: "#facc15" },
      })),
    );
    qc.setQueryData(key, (current: any) =>
      current
        ? {
            ...current,
            sections: current.sections.map((section: any) => {
              const edited = next.find((item) => item.id === section.id);
              return edited
                ? {
                    ...section,
                    plan_area_sqft: polygonAreaSqft(edited.ring),
                    polygon_geojson: { type: "Polygon", coordinates: [edited.ring] },
                  }
                : section;
            }),
          }
        : current,
    );
  };

  const saveEditableFootprints = async (next: EditableFootprint[]) => {
    for (const item of next) {
      const { error: sectionError } = await supabase
        .from("roof_sections")
        .update({
          polygon_geojson: { type: "Polygon", coordinates: [item.ring] },
          plan_area_sqft: polygonAreaSqft(item.ring),
        })
        .eq("id", item.id);
      if (sectionError) throw sectionError;
    }
    const total = Math.round(next.reduce((sum, item) => sum + polygonAreaSqft(item.ring), 0));
    if (data?.measurement?.id) {
      const { error: measurementError } = await supabase
        .from("roof_measurements")
        .update({ total_area_sqft: total })
        .eq("id", data.measurement.id);
      if (measurementError) throw measurementError;
    }
    const { data: session } = await supabase.auth.getSession();
    const { error: trainingError } = await supabase.from("training_examples").insert({
      address: address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
      source: "vertex_edit",
      ground_truth: {
        footprints: next,
        total_plan_sqft: total,
        property_id: data?.property?.id ?? null,
        workflow: "storm_intelligence",
      },
      solar_response: { ai_footprints: next.map((item) => item.originalRing ?? item.ring) },
      notes: "Storm Intelligence exterior footprint correction",
      created_by: session.session?.user.id ?? null,
    });
    if (trainingError) throw trainingError;
    await qc.invalidateQueries({ queryKey: key });
  };

  useEffect(() => {
    onChange({
      propertyId: data?.property?.id ?? null,
      roofType: (data?.property as any)?.roof_type ?? null,
      math,
      planEstimated,
    });
    const feats = (data?.sections ?? [])
      .filter((s: any) => s.polygon_geojson)
      .map((s: any) => ({
        type: "Feature",
        geometry: s.polygon_geojson,
        properties: { color: s.color ?? "#38bdf8", name: s.name },
      }));
    onSections(feats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, planSqft]);

  const measure = useMutation<any, Error, boolean | undefined>({
    mutationFn: async (force?: boolean) => {
      let propertyId = data?.property?.id ?? null;
      if (!propertyId) {
        const ensured: any = await ensureFn({
          data: { lat, lng, address: address ?? undefined },
        });
        if (!ensured?.ok) throw new Error(ensured?.error ?? "Could not save this property");
        propertyId = ensured.property.id;
      }
      const res: any = await measureFn({
        data: { property_id: propertyId!, single: true, footprint, force },
      });

      if (!res?.ok) {
        const reasons: Record<string, string> = {
          google_key_missing: "Measurement service is not configured.",
          no_coordinates: "This point has no usable coordinates.",
          already_measured: "A manual measurement already exists for this property.",
          no_coverage: "No aerial roof coverage available for this address.",
          no_segments: "No roof facets could be detected here.",
          no_property: "Could not resolve the property.",
        };
        throw new Error(reasons[res?.reason] ?? "Measurement failed");
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <Ruler className="h-3.5 w-3.5" /> Roof measurement
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-[11px]">
          <Loader2 className="h-3 w-3 animate-spin" /> Checking for a saved measurement…
        </div>
      )}

      {!!error && !isLoading && (
        <div
          className="flex items-center justify-between gap-2 text-[11px]"
          style={{ color: "var(--danger)" }}
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" /> Could not load measurement
          </span>
          <button type="button" onClick={() => refetch()} className="underline">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && !data?.measurement && (
        <>
          <p className="mb-2 text-[11px] opacity-75">
            No measurement saved for this roof yet. Running one uses a paid aerial lookup, so it
            only happens when you ask for it.
          </p>
          <button
            type="button"
            onClick={() => measure.mutate(false)}
            disabled={measure.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold disabled:opacity-60"
            style={{ background: "var(--success)", color: "#fff" }}
          >
            {measure.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ruler className="h-3.5 w-3.5" />
            )}
            {measure.isPending ? "Measuring…" : "Measure this roof"}
          </button>
          {measure.isPending && (
            <p className="mt-1.5 text-[10px] opacity-70">
              Measuring only the structure you selected — this may take a moment.
            </p>
          )}

          {measure.isError && (
            <div
              className="mt-2 flex items-center justify-between gap-2 text-[11px]"
              style={{ color: "var(--danger)" }}
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                {(measure.error as Error).message}
              </span>
              <button
                type="button"
                onClick={() => measure.mutate(false)}
                className="flex items-center gap-1 underline"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}
        </>
      )}

      {!isLoading && data?.measurement && (
        <div className="space-y-1 text-[11px]">
          {math ? (
            <>
              <Row label="Footprint" value={`${fmt(math.planSqft)} sq ft`} />
              <Row
                label={`+ ${Math.round((PITCH_FACTOR - 1) * 100)}% pitch`}
                value={`${fmt(math.pitchedSqft)} sq ft`}
              />
              <Row
                label={`+ ${Math.round((WASTE_FACTOR - 1) * 100)}% waste`}
                value={`${fmt(math.finalSqft)} sq ft`}
              />
              <div
                className="mt-1 flex items-center justify-between border-t pt-1 text-xs font-semibold text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                <span>Total</span>
                <span className="font-mono">{math.squares.toFixed(1)} squares</span>
              </div>
              <p className="pt-1 text-[10px] opacity-60">
                {(data.sections ?? []).length} facet(s) · pitch{" "}
                {data.measurement.predominant_pitch ?? "—"}
              </p>
            </>
          ) : (
            <>
              <Row
                label="Stored total (pitch-adjusted)"
                value={`${fmt(Number(data.measurement.total_area_sqft ?? 0))} sq ft`}
              />
              <p className="pt-1 text-[10px]" style={{ color: "var(--warning)" }}>
                This measurement has no per-facet footprint data, so the pitch and waste breakdown
                cannot be recomputed from the footprint.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => measure.mutate(true)}
            disabled={measure.isPending}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold text-foreground disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            {measure.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Re-measure this roof
          </button>
          <FootprintOverlayEditor
            map={map}
            footprints={editableFootprints}
            onChange={updateEditableFootprints}
            onSave={saveEditableFootprints}
            compact
          />
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
