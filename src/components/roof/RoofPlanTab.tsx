/**
 * GlobalContractor roof measurement, rendered with the CLAIM BUDDY editor.
 *
 * Consolidation goes this way round on purpose (docs/MEASUREMENT_INVARIANTS.md):
 * one editor, one outline per structure, pin-drop AI trace and hand-drawn
 * polygon both first-class ways to start.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { CbRoofPlanEditor } from "@/components/cb/CbRoofPlanEditor";
import { loadRoofPlan, saveRoofPlan } from "@/lib/roofPlanStore";
import {
  autoClassifyEdges,
  cbSectionColor,
  openRing,
  planTotals,
  type CbEdgeType,
  type CbPlan,
} from "@/lib/cbRoofPlan";

type Segment = { ring: number[][]; pitch: string; plan_area_sqft: number };
type ExtractResponse = {
  segments?: Segment[];
  footprint?: number[][] | null;
  footprint_source?: string | null;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function RoofPlanTab({
  propertyId,
  jobId,
  center,
}: {
  propertyId: string;
  jobId?: string;
  center: { lat: number; lng: number };
}) {
  const qc = useQueryClient();
  const { data: profile } = useProfile();

  const { data: loaded } = useQuery({
    queryKey: ["roof-plan", propertyId],
    queryFn: () => loadRoofPlan(propertyId),
  });

  const [plan, setPlan] = useState<CbPlan>({ sections: [], lines: [] });
  const [aiPlan, setAiPlan] = useState<CbPlan | null>(null);
  const [pins, setPins] = useState<Array<{ lat: number; lng: number }>>([]);
  const [pinDropMode, setPinDropMode] = useState(true);
  const [untraced, setUntraced] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!loaded || hydrated.current) return;
    hydrated.current = true;
    setPlan(loaded.plan);
    if (loaded.plan.sections.length) setPinDropMode(false);
  }, [loaded]);

  const measure = useMutation({
    mutationFn: async () => {
      const pin = pins[pins.length - 1];
      if (!pin) throw new Error("Drop a pin on the roof first");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const r = await fetch("/api/solar-roof-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lat: pin.lat,
          lng: pin.lng,
          property_id: propertyId,
          job_id: jobId ?? undefined,
        }),
      });
      if (!r.ok) {
        let reason = "Could not trace this roof — draw it by hand instead";
        try {
          const err = (await r.json()) as { message?: string; error?: string };
          reason = err.message || err.error || reason;
        } catch {
          /* keep the default */
        }
        throw new Error(reason);
      }
      return { data: (await r.json()) as ExtractResponse, pin };
    },
    onSuccess: ({ data, pin }) => {
      // One outline per structure. The engine no longer splits into facets.
      const ring = openRing(
        data.footprint && data.footprint.length >= 3
          ? data.footprint
          : (data.segments?.[0]?.ring ?? []),
      );
      if (ring.length < 3) {
        toast.error("No outline came back — draw the roof by hand");
        return;
      }
      const index = plan.sections.length;
      const id = uid();
      const section = {
        id,
        name: index === 0 ? "Main roof" : `Structure ${index + 1}`,
        color: cbSectionColor(index),
        ring,
        pitch: data.segments?.[0]?.pitch ?? "6/12",
        edges: autoClassifyEdges(ring) as CbEdgeType[],
        structureKey: id,
        pin,
        isLocked: false,
        aiRing: ring.map((p) => [...p]),
      };
      const next = { ...plan, sections: [...plan.sections, section] };
      setPlan(next);
      setAiPlan({ sections: [...(aiPlan?.sections ?? []), section], lines: [] });
      setUntraced((data.footprint_source ?? "") === "solar_boxes");
      setPinDropMode(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Measurement failed"),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      return saveRoofPlan({
        propertyId,
        companyId: profile.company_id,
        userId: profile.id,
        plan,
        wastePct: loaded?.wastePct ?? 15,
      });
    },
    onSuccess: () => {
      toast.success("Roof measurement saved");
      qc.invalidateQueries({ queryKey: ["roof-measurement", propertyId] });
      qc.invalidateQueries({ queryKey: ["roof-plan", propertyId] });
      qc.invalidateQueries({ queryKey: ["roof-shapes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const totals = planTotals(plan);

  return (
    <div className="space-y-3">
      <CbRoofPlanEditor
        plan={plan}
        onPlanChange={(next) => setPlan(next)}
        center={center}
        aiPlan={aiPlan}
        untracedOutline={untraced}
        measurePins={pins}
        pinDropMode={pinDropMode}
        onPinDrop={(pin) => {
          setPins((p) => [...p, pin]);
          setPinDropMode(false);
        }}
        onPinMove={(i, pin) => setPins((p) => p.map((x, idx) => (idx === i ? pin : x)))}
        onUndoPin={() => setPins((p) => p.slice(0, -1))}
        canUndoPin={pins.length > plan.sections.length}
        onTogglePinDrop={() => setPinDropMode((v) => !v)}
        onClearPins={() => setPins([])}
        onMeasure={() => measure.mutate()}
        measuring={measure.isPending}
        onSaveFootprint={(sectionId) => {
          setPlan((p) => ({
            ...p,
            sections: p.sections.map((s) => (s.id === sectionId ? { ...s, isLocked: true } : s)),
          }));
        }}
      />

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="font-mono-num text-[13px] text-foreground">
          {totals.total_area_sqft.toLocaleString(undefined, { maximumFractionDigits: 0 })} SF ·{" "}
          {totals.facets} structure{totals.facets === 1 ? "" : "s"} · {totals.pitch ?? "—"} pitch
        </div>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !plan.sections.length}
          className="btn-brand inline-flex h-10 items-center gap-2 rounded-md px-5 text-sm font-semibold disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : "Save measurement"}
        </button>
      </div>
    </div>
  );
}
