import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading } from "@/components/cb/primitives";
import { CbField } from "@/components/cb/forms";
import { CbCountUp, CbReveal, cbHaptic } from "@/components/cb/motion";
import { CbJobStepShell } from "@/components/claim-buddy/CbJobStepShell";
/* Deferred: the Mapbox plan editor is a heavy bundle — load it only when a plan exists. */
const CbRoofPlanEditor = lazy(() =>
  import("@/components/cb/CbRoofPlanEditor").then((m) => ({ default: m.CbRoofPlanEditor })),
);
import {
  loadCbRoofPlan,
  saveCbRoofPlan,
  planTotals,
  type CbPlan,
} from "@/lib/cbRoofPlan";
import {
  CB_BLANK_MEASUREMENT,
  CB_LINEAR_FIELDS,
  getInstantMeasurement,
  saveCbMeasurement,
  type CbMeasurement,
} from "@/lib/cbMeasure";


export const Route = createFileRoute("/cb/job/$id/measure")({
  head: () => ({
    meta: [
      { title: "Instant measurement — Claim Buddy" },
      {
        name: "description",
        content:
          "Pull squares, pitch and every linear footage for this property in seconds, then adjust any number by hand.",
      },
      { property: "og:title", content: "Instant measurement — Claim Buddy" },
      {
        property: "og:description",
        content: "Satellite roof measurement inside the Claim Buddy inspection flow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbJobMeasurePage,
});

const STEPS = [
  "Locating property…",
  "Detecting roof facets…",
  "Calculating linear footage…",
  "Finishing up…",
];

function CbJobMeasurePage() {
  const { id } = useParams({ from: "/cb/job/$id/measure" });
  const navigate = useNavigate();
  const [plan, setPlan] = useState<CbPlan>({ sections: [], lines: [] });
  const originalPlanRef = useRef<CbPlan | null>(null);
  const [planDirty, setPlanDirty] = useState(false);


  const [phase, setPhase] = useState<"idle" | "running" | "result" | "manual">("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [values, setValues] = useState<CbMeasurement>(CB_BLANK_MEASUREMENT);
  const [adjust, setAdjust] = useState(false);
  const [repAdjusted, setRepAdjusted] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cb-measure-job", id],
    queryFn: async () => {
      const [{ data: job, error }, { data: existing }] = await Promise.all([
        supabase
          .from("cb_jobs")
          .select("id, workspace_id, address, city, state, zip, lat, lng")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("cb_measurements").select("*").eq("job_id", id).maybeSingle(),
      ]);
      if (error) throw error;
      return { job, existing };
    },
  });

  const job = data?.job;

  useEffect(() => {
    const e = data?.existing;
    if (!e) return;
    setValues({
      ...CB_BLANK_MEASUREMENT,
      total_squares: Number(e.total_squares ?? 0),
      total_area_sqft: Number(e.total_area_sqft ?? 0),
      waste_pct: Number(e.waste_pct ?? 15),
      pitch: e.pitch ?? null,
      stories: e.stories ?? null,
      facets: e.facets ?? null,
      ridge_lf: Number(e.ridge_lf ?? 0),
      hip_lf: Number(e.hip_lf ?? 0),
      valley_lf: Number(e.valley_lf ?? 0),
      rake_lf: Number(e.rake_lf ?? 0),
      eave_lf: Number(e.eave_lf ?? 0),
      drip_edge_lf: Number(e.drip_edge_lf ?? 0),
      starter_lf: Number(e.starter_lf ?? 0),
      ridge_cap_lf: Number(e.ridge_cap_lf ?? 0),
      wall_flashing_lf: Number(e.wall_flashing_lf ?? 0),
      step_flashing_lf: Number(e.step_flashing_lf ?? 0),
      gutter_lf: Number(e.gutter_lf ?? 0),
      source: e.source ?? "manual",
      raw: e.raw ?? null,
    });
    setRepAdjusted(!!e.rep_adjusted);
    setPhase(e.source === "manual" ? "manual" : "result");
  }, [data?.existing]);

  const fullAddress = useMemo(() => {
    if (!job) return "";
    return [job.address, job.city, [job.state, job.zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
  }, [job]);

  const center =
    job?.lat != null && job?.lng != null
      ? { lat: Number(job.lat), lng: Number(job.lng) }
      : null;

  const { data: planData, refetch: refetchPlan } = useQuery({
    queryKey: ["cb-roof-plan", id],
    enabled: !!job,
    queryFn: () => loadCbRoofPlan(id),
  });

  useEffect(() => {
    if (!planData) return;
    setPlan(planData);
    if (!originalPlanRef.current) originalPlanRef.current = planData;
  }, [planData]);

  const { data: reportCount } = useQuery({
    queryKey: ["cb-report-count", id],
    queryFn: async () => {
      const { count } = await supabase
        .from("cb_reports")
        .select("id", { count: "exact", head: true })
        .eq("job_id", id);
      return count ?? 0;
    },
  });
  const planReadOnly = (reportCount ?? 0) > 0;

  function handlePlanChange(next: CbPlan, opts: { user: boolean }) {
    setPlan(next);
    if (!opts.user) return;
    setPlanDirty(true);
    setRepAdjusted(true);
    const t = planTotals(next);
    setValues((v) => ({
      ...v,
      total_squares: t.total_squares,
      total_area_sqft: t.total_area_sqft,
      facets: t.facets,
      pitch: t.pitch ?? v.pitch,
      ridge_lf: t.ridge_lf,
      hip_lf: t.hip_lf,
      valley_lf: t.valley_lf,
      rake_lf: t.rake_lf,
      eave_lf: t.eave_lf,
      gutter_lf: t.gutter_lf,
      wall_flashing_lf: t.wall_flashing_lf,
      step_flashing_lf: t.step_flashing_lf,
      drip_edge_lf: Math.round((t.eave_lf + t.rake_lf) * 10) / 10,
      starter_lf: t.eave_lf,
      ridge_cap_lf: Math.round((t.ridge_lf + t.hip_lf) * 10) / 10,
    }));
  }

  function resetPlan() {
    const original = originalPlanRef.current;
    if (!original) return;
    handlePlanChange(JSON.parse(JSON.stringify(original)) as CbPlan, { user: true });
    toast.message("Restored the satellite shape");
  }


  async function run() {
    if (!job?.workspace_id) return;
    cbHaptic();
    setPhase("running");
    setStepIdx(0);
    const timer = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 1400);

    const res = await getInstantMeasurement({
      address: fullAddress,
      lat: job.lat != null ? Number(job.lat) : null,
      lng: job.lng != null ? Number(job.lng) : null,
      workspaceId: job.workspace_id,
      jobId: id,
    });
    clearInterval(timer);
    setRemaining(res.credit.metered ? res.credit.remaining : null);

    if (res.ok) {
      setValues(res.measurement);
      setRepAdjusted(false);
      setPhase("result");
      originalPlanRef.current = null;
      setPlanDirty(false);
      const fresh = await refetchPlan();
      if (fresh.data) originalPlanRef.current = fresh.data;
      return;
    }
    setUpgrade(res.reason === "no_credits");
    setValues((v) => ({ ...v, source: "manual" }));
    setPhase("manual");
    toast.message(
      res.reason === "no_credits"
        ? "Out of measurement credits — enter it by hand"
        : res.reason === "no_coverage" || res.reason === "no_footprint"
          ? "No satellite roof data for this address — trace it or type it in"
          : "Couldn't measure from satellite — enter it by hand",
    );

  }

  function edit(patch: Partial<CbMeasurement>) {
    setValues((v) => ({ ...v, ...patch }));
    setRepAdjusted(true);
  }

  async function save() {
    setSaving(true);
    try {
      const handEdited = repAdjusted || phase === "manual";
      if (!planReadOnly && (planDirty || plan.sections.length)) {
        await saveCbRoofPlan(id, plan, { repAdjusted: handEdited });
      }
      await saveCbMeasurement(id, values, handEdited);
      cbHaptic();
      toast.success("Measurement saved");
      navigate({ to: "/cb/job/$id/scope", params: { id } });
    } catch {
      toast.error("Couldn't save the measurement — try again");
    } finally {
      setSaving(false);
    }
  }


  const editable = phase === "manual" || adjust;

  return (
    <CbSurface>
      <CbJobStepShell
        step={2}
        jobId={id}
        title="Instant measurement"
        subtitle="Satellite numbers in seconds — override anything that looks off."
      >
        {isLoading ? (
          <CbLoading label="Loading property…" />
        ) : (
          <div className="space-y-4">
            <CbCard className="p-4">
              <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                Property
              </p>
              <p className="mt-1 text-[16px] font-semibold">{fullAddress || "No address yet"}</p>
              {!center ? (
                <p className="mt-3 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                  No coordinates on this job yet — you can still enter measurements by hand.
                </p>
              ) : null}

              {remaining != null ? (
                <p className="mt-3 cb-num text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                  {remaining} measurement credits left
                </p>
              ) : null}
            </CbCard>

            {center || plan.sections.length ? (
              <Suspense fallback={<CbLoading label="Loading roof plan editor…" />}>
              <CbRoofPlanEditor
                plan={plan}
                onPlanChange={handlePlanChange}
                center={center}
                readOnly={planReadOnly}
                onReset={resetPlan}
                canReset={!!originalPlanRef.current?.sections.length}
              />
              </Suspense>
            ) : null}



            {phase === "idle" ? (
              <div className="space-y-3">
                <CbButton block onClick={run} disabled={!job?.workspace_id}>
                  Get instant measurement
                </CbButton>
                <CbButton block variant="ghost" onClick={() => setPhase("manual")}>
                  Enter measurements by hand
                </CbButton>
              </div>
            ) : null}

            {phase === "running" ? (
              <CbCard className="p-5">
                <div className="space-y-2">
                  {STEPS.map((s, i) => (
                    <p
                      key={s}
                      className="text-[15px] transition-opacity"
                      style={{
                        opacity: i < stepIdx ? 0.45 : i === stepIdx ? 1 : 0.2,
                        fontWeight: i === stepIdx ? 700 : 500,
                      }}
                    >
                      {s}
                    </p>
                  ))}
                </div>
              </CbCard>
            ) : null}

            {phase === "result" || phase === "manual" ? (
              <>
                {upgrade ? (
                  <CbCard className="p-4">
                    <CbBadge>Out of credits</CbBadge>
                    <p className="mt-2 text-[14px]">
                      This workspace is out of instant measurements. Upgrade the plan to keep pulling
                      satellite numbers — meanwhile, hand entry works exactly the same downstream.
                    </p>
                  </CbCard>
                ) : null}

                <CbReveal>
                  <CbCard className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
                          Total squares
                        </p>
                        <p className="text-[40px] font-extrabold leading-none">
                          <CbCountUp value={values.total_squares} decimals={2} />
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
                          Roof area
                        </p>
                        <p className="text-[24px] font-bold leading-none">
                          <CbCountUp value={values.total_area_sqft} suffix=" sf" />
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <CbBadge>{values.pitch ?? "pitch —"}</CbBadge>
                      <CbBadge>{values.facets ?? 0} facets</CbBadge>
                      <CbBadge>{values.waste_pct}% waste</CbBadge>
                      <CbBadge>
                        {values.source === "manual" ? "Manual entry" : `Source: ${values.source}`}
                      </CbBadge>
                      {repAdjusted ? <CbBadge>Rep adjusted</CbBadge> : null}
                    </div>

                    {phase === "result" ? (
                      <div className="mt-4">
                        <CbButton
                          variant="secondary"
                          size="md"
                          onClick={() => setAdjust((a) => !a)}
                          aria-expanded={adjust}
                        >
                          {adjust ? "Done adjusting" : "Adjust"}
                        </CbButton>
                      </div>
                    ) : null}
                  </CbCard>
                </CbReveal>

                {editable ? (
                  <CbCard className="space-y-3 p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <CbField
                        label="Total squares"
                        type="number"
                        inputMode="decimal"
                        value={values.total_squares || ""}
                        onChange={(e) => edit({ total_squares: Number(e.target.value) || 0 })}
                      />
                      <CbField
                        label="Roof area (sf)"
                        type="number"
                        inputMode="decimal"
                        value={values.total_area_sqft || ""}
                        onChange={(e) => edit({ total_area_sqft: Number(e.target.value) || 0 })}
                      />
                      <CbField
                        label="Waste %"
                        type="number"
                        inputMode="decimal"
                        value={values.waste_pct || ""}
                        onChange={(e) => edit({ waste_pct: Number(e.target.value) || 0 })}
                      />
                      <CbField
                        label="Pitch"
                        value={values.pitch ?? ""}
                        onChange={(e) => edit({ pitch: e.target.value })}
                      />
                      <CbField
                        label="Stories"
                        type="number"
                        inputMode="numeric"
                        value={values.stories ?? ""}
                        onChange={(e) => edit({ stories: Number(e.target.value) || 0 })}
                      />
                      <CbField
                        label="Facets"
                        type="number"
                        inputMode="numeric"
                        value={values.facets ?? ""}
                        onChange={(e) => edit({ facets: Number(e.target.value) || 0 })}
                      />
                    </div>

                    <p className="pt-1 text-[12px] uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
                      Linear footage
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {CB_LINEAR_FIELDS.map((f) => (
                        <CbField
                          key={f.key}
                          label={`${f.label} (LF)`}
                          type="number"
                          inputMode="decimal"
                          value={(values[f.key] as number) || ""}
                          onChange={(e) =>
                            edit({ [f.key]: Number(e.target.value) || 0 } as Partial<CbMeasurement>)
                          }
                        />
                      ))}
                    </div>
                  </CbCard>
                ) : (
                  <CbCard className="p-4">
                    <div className="grid grid-cols-2 gap-y-2">
                      {CB_LINEAR_FIELDS.map((f) => (
                        <div key={f.key} className="flex items-baseline justify-between gap-2 pr-3">
                          <span className="text-[14px]" style={{ color: "var(--cb-text-muted)" }}>
                            {f.label}
                          </span>
                          <span className="cb-num text-[15px] font-semibold">
                            {Math.round(values[f.key] as number)} LF
                          </span>
                        </div>
                      ))}
                    </div>
                  </CbCard>
                )}

                <div className="space-y-3">
                  <CbButton block onClick={save} loading={saving} loadingText="Saving…">
                    Save measurement
                  </CbButton>
                  {phase === "manual" ? (
                    <CbButton block variant="ghost" onClick={run} disabled={!job?.workspace_id}>
                      Try instant measurement again
                    </CbButton>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        )}
      </CbJobStepShell>
    </CbSurface>
  );
}
