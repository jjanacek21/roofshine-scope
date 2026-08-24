import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading } from "@/components/cb/primitives";
import { CbField } from "@/components/cb/forms";
import { CbCountUp, CbReveal, cbHaptic } from "@/components/cb/motion";
import { CbJobStepShell } from "@/components/claim-buddy/CbJobStepShell";
import { CbErrorBoundary } from "@/components/cb/CbErrorBoundary";
/* Deferred: the Mapbox plan editor is a heavy bundle — load it only when a plan exists. */
const CbRoofPlanEditor = lazy(() =>
  import("@/components/cb/CbRoofPlanEditor").then((m) => ({ default: m.CbRoofPlanEditor })),
);
import {
  loadCbRoofPlan,
  saveCbRoofPlan,
  planTotals,
  mergeSectionsByStructure,
  cbSectionColor,

  type CbPlan,
} from "@/lib/cbRoofPlan";

import {
  CB_BLANK_MEASUREMENT,
  CB_DERIVED_FIELDS,
  CB_LINEAR_FIELDS,
  applyDerived,
  computeTotalSquares,
  derivePerimeter,
  getInstantMeasurement,
  saveCbMeasurement,
  type CbMeasurement,
} from "@/lib/cbMeasure";
import { saveCbRoofCorrectionFn } from "@/lib/cb-roof-correction.functions";
import { useCbFeatureGuard } from "@/components/claim-buddy/CbFeatureGate";



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
  /** Derived fields a rep chose to type by hand. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const [adjust, setAdjust] = useState(false);
  const [repAdjusted, setRepAdjusted] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  /** True when the last measurement fell back to a fitted rectangle. */
  const [untracedOutline, setUntracedOutline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [measurePins, setMeasurePins] = useState<Array<{ lat: number; lng: number }>>([]);
  /** How many dropped pins have already been traced. */
  const [measuredCount, setMeasuredCount] = useState(0);
  const [pinDropMode, setPinDropMode] = useState(true);
  const saveCorrection = useServerFn(saveCbRoofCorrectionFn);

  const [editorKey, setEditorKey] = useState(0);

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
    setValues(
      applyDerived({
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
      }),
    );

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

  /** The untouched AI trace, kept so the editor can show it + confidence. */
  const [aiPlan, setAiPlan] = useState<CbPlan | null>(null);

  const { data: planData, refetch: refetchPlan } = useQuery({
    queryKey: ["cb-roof-plan", id],
    enabled: !!job,
    queryFn: () => loadCbRoofPlan(id),
  });

  useEffect(() => {
    if (!planData) return;
    let cancelled = false;
    // One highlighted outline per structure — never a pile of overlapping facets.
    void mergeSectionsByStructure(planData, measurePins).then((collapsed) => {
      if (cancelled) return;
      setPlan(collapsed);
      const storedPins = collapsed.sections.flatMap((section) => (section.pin ? [section.pin] : []));
      setMeasurePins(storedPins);
      setMeasuredCount(storedPins.length);
      setPinDropMode(collapsed.sections.length === 0);
      if (!originalPlanRef.current) originalPlanRef.current = collapsed;
      setAiPlan((cur) => cur ?? collapsed);
      if (collapsed.sections.length !== planData.sections.length) {
        setPlanDirty(true);
        // Persist the repaired structure keys once so legacy plans stop re-splitting.
        if (!planReadOnly) {
          void saveCbRoofPlan(id, collapsed, { repAdjusted: false }).catch(() => undefined);
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  /** Traced outline length — the perimeter fallback when edges are unlabeled. */
  const planPerimeter = useMemo(() => planTotals(plan).perimeter_lf, [plan]);


  function handlePlanChange(next: CbPlan, opts: { user: boolean }) {
    setPlan(next);
    if (!opts.user) return;
    setPlanDirty(true);
    setRepAdjusted(true);
    const t = planTotals(next);
    setValues((v) =>
      applyDerived(
        {
          ...v,
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
        },
        { perimeterFallback: t.perimeter_lf, overrides },
      ),
    );
  }


  function resetPlan() {
    const original = originalPlanRef.current;
    if (!original) return;
    handlePlanChange(JSON.parse(JSON.stringify(original)) as CbPlan, { user: true });
    toast.message("Restored the satellite shape");
  }


  async function run() {
    if (!job?.workspace_id) return;
    if (!featureGuard("ai_measure")) {
      setPhase("manual");
      return;
    }
    if (measurePins.length === 0) {
      setPinDropMode(true);
      toast.message("Tap the roof on the satellite map to drop a measurement pin");
      return;
    }
    const newPin = measurePins[measuredCount];
    if (!newPin) {
      toast.message("Drop another pin before measuring another roof");
      return;
    }
    const preserved = plan;

    cbHaptic();
    setPhase("running");
    setStepIdx(0);
    const timer = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 1400);

    /*
     * Hard time budget. A thrown server function or a stalled footprint lookup
     * used to leave the screen on "Measuring…" forever with no way out.
     */
    type MeasureResult = Awaited<ReturnType<typeof getInstantMeasurement>>;
    let res: MeasureResult;
    try {
      res = await Promise.race([
        getInstantMeasurement({
          address: fullAddress,
          lat: job.lat != null ? Number(job.lat) : null,
          lng: job.lng != null ? Number(job.lng) : null,
          workspaceId: job.workspace_id,
          jobId: id,
          pins: [newPin],
        }),
        new Promise<MeasureResult>((_, reject) =>
          setTimeout(() => reject(new Error("measure_timeout")), 75_000),
        ),
      ]);
    } catch (error) {
      clearInterval(timer);
      setPhase("manual");
      setValues((v) => ({ ...v, source: "manual" }));
      toast.error(
        error instanceof Error && error.message === "measure_timeout"
          ? "Satellite measurement took too long — move the pin and try again, or type it in"
          : "Couldn't measure from satellite — move the pin and try again, or type it in",
      );
      return;
    }
    clearInterval(timer);
    setRemaining(res.credit.metered ? res.credit.remaining : null);


    if (res.ok) {
      setOverrides({});
      setRepAdjusted(false);
      /*
       * `solar_boxes` is a rectangle fitted around Google's roof boxes — never
       * a traced outline. Flag it instead of letting it pass as measured.
       */
      const untraced = (res.footprint_source ?? "").includes("solar_boxes");
      setUntracedOutline(untraced);
      if (untraced) {
        toast.warning("Couldn't trace the roof edges — drag the corners onto the roof");
      }


      setPhase("result");
      originalPlanRef.current = null;
      setPlanDirty(false);
      const fresh = await refetchPlan();
      if (fresh.data) {
        // One highlighted outline per dropped pin: pin 1 is the main roof,
        // pin 2 the flat roof, pin 3 the shed — each with its own colour.
        const merged = await mergeSectionsByStructure(fresh.data, [newPin]);
        const structureIndex = preserved.sections.length;
        const key = `structure-${crypto.randomUUID()}`;
        const added = merged.sections.slice(0, 1).map((s) => ({
          ...s,
          structureKey: key,
          pin: newPin,
          isLocked: false,
          aiRing: s.ring.map((point) => [...point]),
          name: structureIndex === 0 ? "Main roof" : structureIndex === 1 ? "Flat roof" : `Structure ${structureIndex + 1}`,
          color: cbSectionColor(structureIndex),
        }));
        const next: CbPlan = {
          sections: [...preserved.sections, ...added],
          lines: preserved.lines,
        };
        setPlan(next);
        originalPlanRef.current = JSON.parse(JSON.stringify(next)) as CbPlan;
        setAiPlan({ sections: next.sections.map((s) => ({ ...s, ring: (s.aiRing ?? s.ring).map((p) => [...p]) })), lines: [] });
        const totals = planTotals(next);
        setValues((current) => applyDerived({
          ...current,
          total_area_sqft: totals.total_area_sqft,
          facets: totals.facets,
          pitch: totals.pitch ?? current.pitch,
          ridge_lf: totals.ridge_lf,
          hip_lf: totals.hip_lf,
          valley_lf: totals.valley_lf,
          rake_lf: totals.rake_lf,
          eave_lf: totals.eave_lf,
          gutter_lf: totals.gutter_lf,
          wall_flashing_lf: totals.wall_flashing_lf,
          step_flashing_lf: totals.step_flashing_lf,
        }, { perimeterFallback: totals.perimeter_lf }));
        await saveCbRoofPlan(id, next, { repAdjusted: false });
        setPlanDirty(true);
      }

      setMeasuredCount((count) => count + 1);
      setPinDropMode(false);
      return;
    }

    setUpgrade(res.reason === "no_credits");
    setValues((v) => ({ ...v, source: "manual" }));
    setPhase("manual");
    toast.message(
      res.reason === "no_credits"
        ? "Out of measurement credits — enter it by hand"
        : res.reason.startsWith("tracer_")
          ? `The roof tracer could not finish (${res.reason.replace("tracer_", "").replaceAll("_", " ")}) — move the pin and try again`
          : res.reason.startsWith("save_")
            ? "The roof was traced but could not be saved — try again"
            : res.reason.startsWith("engine_error:")
              ? `Measurement failed: ${res.reason.slice("engine_error:".length)}`
          : res.reason === "no_coverage" || res.reason === "no_footprint"
            ? "No satellite roof data for this address — trace it or type it in"
            : "Couldn't measure from satellite — enter it by hand",
    );

  }

  async function saveFootprint(sectionId: string) {
    const section = plan.sections.find((item) => item.id === sectionId);
    if (!section) return;
    const lockedSection = { ...section, isLocked: true };
    const next = {
      ...plan,
      sections: plan.sections.map((item) => (item.id === sectionId ? lockedSection : item)),
    };
    setSaving(true);
    try {
      await saveCbRoofPlan(id, next, { repAdjusted: true });
      await saveCorrection({ data: { jobId: id, section: lockedSection } });
      setPlan(next);
      setPlanDirty(false);
      setRepAdjusted(true);
      toast.success("Footprint saved — AI will remember this roof");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this footprint");
    } finally {
      setSaving(false);
    }
  }

  function edit(patch: Partial<CbMeasurement>) {
    setValues((v) =>
      applyDerived({ ...v, ...patch }, { perimeterFallback: planPerimeter, overrides }),
    );
    setRepAdjusted(true);
  }

  /** Type over a derived number — it stops recalculating until reset. */
  function overrideEdit(key: "drip_edge_lf" | "starter_lf" | "ridge_cap_lf" | "total_squares", v: number) {
    setOverrides((o) => ({ ...o, [key]: true }));
    setValues((prev) => ({ ...prev, [key]: v }));
    setRepAdjusted(true);
  }

  function clearOverride(key: string) {
    const next = { ...overrides, [key]: false };
    setOverrides(next);
    setValues((v) => applyDerived(v, { perimeterFallback: planPerimeter, overrides: next }));
  }


  async function save(dest: "takeoff" | "estimate" = "takeoff") {
    setSaving(true);
    const handEdited = repAdjusted || phase === "manual";
    let planFailed: string | null = null;

    // The roof plan is a bonus — never let it block the numbers or the next step.
    if (!planReadOnly && (planDirty || plan.sections.length)) {
      try {
        await saveCbRoofPlan(id, plan, { repAdjusted: handEdited });
      } catch (e) {
        planFailed = e instanceof Error ? e.message : "unknown error";
      }
    }

    try {
      await saveCbMeasurement(id, values, handEdited);
      cbHaptic();
      if (planFailed) toast.warning(`Numbers saved — roof outline didn't: ${planFailed}`);
      else toast.success("Measurement saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      toast.error(`Couldn't save the measurement: ${msg}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    if (dest === "estimate") {
      navigate({ to: "/cb/job/$id/estimate", params: { id } });
    } else {
      navigate({ to: "/cb/job/$id/roof", params: { id } });
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
              <CbErrorBoundary
                key={editorKey}
                fallback={(error, reset) => (
                  <CbCard className="p-4">
                    <p className="text-[14px] font-semibold">Satellite map couldn&apos;t load</p>
                    <p className="mt-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                      Your measurement is safe — you can still save it and keep going.
                    </p>
                    <div className="mt-3 space-y-1">
                      {plan.sections.length ? (
                        plan.sections.map((s, i) => (
                          <p key={s.id} className="cb-num text-[13px]">
                            {s.name || `Structure ${i + 1}`} · {s.pitch}
                          </p>
                        ))
                      ) : (
                        <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                          No traced facets on this job yet.
                        </p>
                      )}
                    </div>
                    <p className="mt-3 text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                      {error.message}
                    </p>
                    <div className="mt-4">
                      <CbButton
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          reset();
                          setEditorKey((k) => k + 1);
                        }}
                      >
                        Retry map
                      </CbButton>
                    </div>
                  </CbCard>
                )}
              >
                <Suspense fallback={<CbLoading label="Loading roof plan editor…" />}>
                  <CbRoofPlanEditor
                    plan={plan}
                    onPlanChange={handlePlanChange}
                    center={center}
                    readOnly={planReadOnly}
                    onReset={resetPlan}
                    canReset={!!originalPlanRef.current?.sections.length}
                    measurePins={measurePins}
                    pinDropMode={pinDropMode}
                    onTogglePinDrop={() => setPinDropMode((active) => !active)}
                    onPinDrop={(pin) => {
                      setMeasurePins((pins) => [...pins, pin]);
                      setPinDropMode(false);
                      toast.success("Roof pin placed");
                    }}
                    onPinMove={(index, pin) => {
                      setMeasurePins((pins) =>
                        pins.map((current, pinIndex) => (pinIndex === index ? pin : current)),
                      );
                    }}
                    canUndoPin={measurePins.length > measuredCount}
                    onUndoPin={() => {
                      setMeasurePins((pins) => pins.slice(0, -1));
                      setPinDropMode(true);
                      toast.message("Pin removed — tap the roof to place it again");
                    }}
                    onClearPins={() => {
                      setMeasurePins([]);
                      setMeasuredCount(0);
                      setPinDropMode(true);
                    }}

                    onMeasure={() => void run()}
                    measuring={phase === "running"}
                    aiPlan={aiPlan}
                    onSaveFootprint={(sectionId) => void saveFootprint(sectionId)}
                    savingFootprint={saving}
                    untracedOutline={untracedOutline}
                  />
                </Suspense>
              </CbErrorBoundary>
            ) : null}



            {phase === "result" && plan.sections.length ? (
              <>
                <CbCard className="p-4">
                  <p className="text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                    Drag the corners onto the real roof edges, tap a midpoint to add a corner, hold
                    a corner to delete it — then tap <strong>Save roof footprint</strong> to lock it
                    in. After that, draw every ridge, hip and valley with the Line tool and tap any
                    line to label it eave, rake, ridge, hip, valley or flashing.
                  </p>
                </CbCard>

                {plan.sections.every((section) => section.isLocked) ? <CbCard className="p-4">
                  <p className="text-[14px] font-semibold">Another structure on this property?</p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                    A flat roof section, a detached garage or a shed is measured separately. Drop a
                    pin on it and measure again — it gets added as its own structure.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CbButton
                      size="md"
                      variant="secondary"
                      onClick={() => {
                        setPinDropMode(true);
                        toast.message("Tap the flat roof, garage or shed to drop a pin");
                      }}
                    >
                      Drop another pin
                    </CbButton>
                    {measurePins.length > measuredCount ? (
                      <CbButton size="md" onClick={() => void run()} disabled={phase !== "result"}>
                        Measure new pin
                        {measurePins.length - measuredCount === 1 ? "" : "s"}
                      </CbButton>
                    ) : null}

                  </div>
                </CbCard> : null}
              </>
            ) : null}

            {phase === "idle" ? (
              <div className="space-y-3">
                <CbButton block onClick={run} disabled={!job?.workspace_id}>
                  {measurePins.length
                    ? `Measure ${measurePins.length} pinned roof${measurePins.length === 1 ? "" : "s"}`
                    : "Tap roof to drop measurement pin"}
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
                          Total squares (with waste)
                        </p>
                        <p className="text-[40px] font-extrabold leading-none">
                          <CbCountUp value={values.total_squares} decimals={2} />
                        </p>
                        <p className="mt-1 cb-num text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                          {Math.round(values.total_area_sqft).toLocaleString()} sf + {values.waste_pct}% waste
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
                          Roof area (true)
                        </p>
                        <p className="text-[24px] font-bold leading-none">
                          <CbCountUp value={values.total_area_sqft} suffix=" sf" />
                        </p>
                        <p className="mt-1 cb-num text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                          {(values.total_area_sqft / 100).toFixed(2)} SQ before waste
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <CbBadge>{values.pitch ?? "pitch —"}</CbBadge>
                      <CbBadge>{values.facets ?? 0} facets</CbBadge>
                      <CbBadge>{values.waste_pct}% waste</CbBadge>
                      <CbBadge>Perimeter {Math.round(derivePerimeter(values, planPerimeter))} LF</CbBadge>
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
                        label="Roof area (sf, no waste)"
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
                    <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                      Total squares recalculates from area and waste —{" "}
                      <span className="cb-num">{values.total_squares.toFixed(2)} SQ</span>.
                    </p>

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

                    <p className="pt-1 text-[12px] uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
                      Derived — calculated, not measured twice
                    </p>
                    <div className="grid gap-2">
                      {CB_DERIVED_FIELDS.map((f) => (
                        <div key={f.key} className="flex items-center gap-2">
                          <span className="flex-1 text-[14px]" style={{ color: "var(--cb-text)" }}>
                            {f.label}
                            <span className="cb-microlabel block">{f.basis}</span>
                          </span>
                          {overrides[f.key] ? (
                            <input
                              className="cb-input cb-num"
                              inputMode="decimal"
                              aria-label={`${f.label} LF`}
                              style={{ width: 96, height: 48, textAlign: "right", padding: "0 10px" }}
                              value={(values[f.key] as number) || ""}
                              onChange={(e) => overrideEdit(f.key, Number(e.target.value) || 0)}
                            />
                          ) : (
                            <span className="cb-num text-[15px] font-semibold">
                              {Math.round(values[f.key] as number)} LF
                            </span>
                          )}
                          <CbButton
                            size="md"
                            variant="ghost"
                            onClick={() =>
                              overrides[f.key] ? clearOverride(f.key) : overrideEdit(f.key, values[f.key] as number)
                            }
                          >
                            {overrides[f.key] ? "Auto" : "Override"}
                          </CbButton>
                        </div>
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
                    <div
                      className="mt-3 grid gap-1 border-t pt-3"
                      style={{ borderColor: "var(--cb-border)" }}
                    >
                      {CB_DERIVED_FIELDS.map((f) => (
                        <div key={f.key} className="flex items-baseline justify-between gap-2 pr-3">
                          <span className="text-[14px]" style={{ color: "var(--cb-text-muted)" }}>
                            {f.label} <span className="cb-microlabel">({f.basis})</span>
                          </span>
                          <span className="cb-num text-[15px] font-semibold">
                            {Math.round(values[f.key] as number)} LF
                          </span>
                        </div>
                      ))}
                    </div>
                  </CbCard>
                )}


                {phase === "result" ? (
                  <CbCard className="p-4">
                    <p className="text-[12px] uppercase tracking-wider" style={{ color: "var(--cb-text-muted)" }}>
                      Turn this into a price
                    </p>
                    <p className="mt-2 text-[14px]" style={{ color: "var(--cb-text-muted)" }}>
                      Fill in the rest of the roof (vents, flashing, hardware) for a full line item
                      estimate off the price book, or drop a price per square for a quick number
                      with a scope list and one total.
                    </p>
                    <div className="mt-4 space-y-2">
                      <CbButton block variant="secondary" onClick={() => setAdjust(true)}>
                        Add the rest of the measurements
                      </CbButton>
                      <CbButton block onClick={() => void save("estimate")} loading={saving} loadingText="Saving…">
                        Price it now
                      </CbButton>
                    </div>
                  </CbCard>
                ) : null}

                <div className="space-y-3">
                  <CbButton block variant="ghost" onClick={() => setPinDropMode(true)}>
                    Add another roof
                  </CbButton>
                </div>

              </>
            ) : null}
          </div>
        )}

        {/* Always reachable: this step can never trap a rep on a roof. */}
        <div className="cb-dock">
          <div className="mx-auto flex w-full max-w-[620px] items-center gap-2">
            <CbButton
              block
              onClick={() => void save("takeoff")}
              disabled={!!plan.sections.length && !plan.sections.every((section) => section.isLocked)}
              loading={saving}
              loadingText="Saving…"
            >
              Save roof measurements &amp; continue
            </CbButton>
            <CbButton
              variant="ghost"
              size="md"
              onClick={() => navigate({ to: "/cb/job/$id/scope", params: { id } })}
            >
              Skip
            </CbButton>
          </div>
        </div>
      </CbJobStepShell>

    </CbSurface>
  );
}
