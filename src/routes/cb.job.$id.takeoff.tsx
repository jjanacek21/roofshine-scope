import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, Plus, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading, CbChip } from "@/components/cb/primitives";
import { CbField, CbTextarea, CbCheckbox, useScrollMemory } from "@/components/cb/forms";
import { CbReveal, cbHaptic } from "@/components/cb/motion";
import { CbCamera } from "@/components/cb/CbCamera";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { useCbTakeoff } from "@/lib/cbTakeoff";
import {
  CB_DECKING_CONDITION,
  CB_DECKING_TYPES,
  CB_FLASH_MATERIALS,
  CB_GUTTER_MATERIALS,
  CB_GUTTER_SIZES,
  CB_ROOF_TYPES,
  CB_SKYLIGHT_TYPES,
  computeVentilation,
  overallCompleteness,
  readSheet,
  scoreSheet,
  type CbSheet,
} from "@/lib/cbSheet";
import { CB_LINEAR_FIELDS, type CbMeasurement } from "@/lib/cbMeasure";

export const Route = createFileRoute("/cb/job/$id/takeoff")({
  head: () => ({
    meta: [
      { title: "Roof takeoff — Claim Buddy" },
      {
        name: "description",
        content:
          "Structured roof takeoff: system, flashing, ventilation NFA, penetrations, skylights, solar, gutters and hardware.",
      },
      { property: "og:title", content: "Roof takeoff — Claim Buddy" },
      {
        property: "og:description",
        content: "The sheet that drives the scope — photos support it, they do not replace it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbTakeoffPage,
});

/* ---------------- small building blocks ---------------- */

function Section({
  title,
  hint,
  pct,
  children,
}: {
  title: string;
  hint?: string;
  pct?: number;
  children: React.ReactNode;
}) {
  return (
    <CbReveal>
      <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="cb-display" style={{ fontSize: 17, margin: 0 }}>
              {title}
            </h2>
            {hint ? (
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                {hint}
              </p>
            ) : null}
          </div>
          {typeof pct === "number" ? (
            <CbBadge tone={pct >= 100 ? "success" : pct > 0 ? "accent" : "neutral"}>{pct}%</CbBadge>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3">{children}</div>
      </CbCard>
    </CbReveal>
  );
}

function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="cb-microlabel">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => {
              cbHaptic();
              onChange(o);
            }}
            className={`cb-seg-card ${value === o ? "is-selected" : ""}`}
            style={{ padding: "10px 14px", minHeight: 44 }}
          >
            <span className="cb-seg-title" style={{ fontSize: 13.5 }}>
              {o}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A quantity line with a camera icon that links the photo to this exact item. */
function QtyLine({
  label,
  suffix,
  value,
  onChange,
  itemKey,
  onCamera,
  photos,
}: {
  label: string;
  suffix?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  itemKey: string;
  onCamera: (itemKey: string, label: string) => void;
  photos: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex-1 min-w-0 text-[15px]" style={{ color: "var(--cb-text)" }}>
        <span className="block truncate">{label}</span>
        {suffix ? <span className="cb-microlabel">{suffix}</span> : null}
      </label>
      <input
        className="cb-input cb-num"
        inputMode="decimal"
        style={{ width: 96, height: 48, textAlign: "right", padding: "0 10px" }}
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(v === "" ? undefined : Number(v));
        }}
      />
      <button
        type="button"
        className={`cb-icon-btn ${photos > 0 ? "is-active" : ""}`}
        aria-label={`Photograph ${label}`}
        onClick={() => {
          cbHaptic();
          onCamera(itemKey, label);
        }}
        style={{
          height: 48,
          width: 48,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--cb-border)",
          background: photos > 0 ? "var(--cb-accent-soft, transparent)" : "transparent",
          color: photos > 0 ? "var(--cb-accent)" : "var(--cb-text-muted)",
          flexShrink: 0,
        }}
      >
        <Camera size={18} strokeWidth={1.7} />
      </button>
    </div>
  );
}

/* ---------------- page ---------------- */

function CbTakeoffPage() {
  const { id } = useParams({ from: "/cb/job/$id/takeoff" });
  const navigate = useNavigate();
  useScrollMemory(`takeoff_${id}`);

  const { takeoff, isLoading } = useCbTakeoff(id);
  const [sheet, setSheet] = useState<CbSheet | null>(null);
  const [measure, setMeasure] = useState<Partial<CbMeasurement> | null>(null);
  const [measureDirty, setMeasureDirty] = useState(false);
  const [cam, setCam] = useState<{ itemKey: string; label: string } | null>(null);
  const hydrated = useRef(false);

  const { data: job } = useQuery({
    queryKey: ["cb-takeoff-job", id],
    queryFn: async () => {
      const [{ data: j }, { data: m }, { data: photos }] = await Promise.all([
        supabase.from("cb_jobs").select("id, workspace_id, address, city, state").eq("id", id).maybeSingle(),
        supabase.from("cb_measurements").select("*").eq("job_id", id).maybeSingle(),
        supabase.from("cb_photos").select("item_key").eq("job_id", id).eq("category", "takeoff"),
      ]);
      return { job: j, measurement: m, photos: photos ?? [] };
    },
  });

  const photoCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of job?.photos ?? []) {
      const k = (p as { item_key: string | null }).item_key ?? "";
      if (k) map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [job?.photos]);

  useEffect(() => {
    if (hydrated.current || isLoading) return;
    hydrated.current = true;
    setSheet(readSheet(takeoff.data as Record<string, unknown>));
  }, [isLoading, takeoff.data]);

  useEffect(() => {
    if (measure || !job?.measurement) return;
    setMeasure(job.measurement as Partial<CbMeasurement>);
  }, [job?.measurement, measure]);

  const squares = Number(measure?.total_squares ?? 0);
  const vent = useMemo(
    () => computeVentilation(sheet?.ventilation ?? {}, squares, measure?.pitch ?? sheet?.roof_system.pitch),
    [sheet, squares, measure?.pitch],
  );
  const scores = useMemo(() => (sheet ? scoreSheet(sheet, squares) : []), [sheet, squares]);
  const completeness = overallCompleteness(scores);

  /* debounced persistence */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(
    (next: CbSheet) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const nextScores = scoreSheet(next, squares);
        const ventCalc = computeVentilation(next.ventilation, squares, next.roof_system.pitch);
        const data = {
          ...(takeoff.data as Record<string, unknown>),
          sheet: next,
          ventilation_calc: {
            attic_sqft: ventCalc.atticSqft,
            required_nfa: ventCalc.requiredNfa,
            provided_nfa: ventCalc.providedNfa,
            under: ventCalc.under,
            recommendation: ventCalc.recommendation,
          },
          section_scores: nextScores,
        };
        await supabase.from("cb_takeoffs").upsert(
          {
            job_id: id,
            data: data as never,
            elevations: (takeoff.elevations ?? {}) as never,
            completeness: overallCompleteness(nextScores),
          },
          { onConflict: "job_id" },
        );
      }, 700);
    },
    [id, squares, takeoff.data, takeoff.elevations],
  );

  const update = useCallback(
    (fn: (s: CbSheet) => CbSheet) => {
      setSheet((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const patch = useCallback(
    <K extends keyof CbSheet>(key: K, part: Partial<CbSheet[K]>) =>
      update((s) => ({ ...s, [key]: { ...(s[key] as object), ...part } })),
    [update],
  );

  async function saveMeasurement() {
    if (!measure) return;
    await supabase
      .from("cb_measurements")
      .upsert({ job_id: id, ...measure, rep_adjusted: true } as never, { onConflict: "job_id" });
    setMeasureDirty(false);
  }

  if (isLoading || !sheet) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Opening the takeoff sheet…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  const pctOf = (k: string) => scores.find((s) => s.key === k)?.pct ?? 0;
  const openCam = (itemKey: string, label: string) => setCam({ itemKey, label });

  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-32 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                Roof takeoff
              </h1>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                This sheet drives the scope. The photos support it — they do not replace it.
              </p>
            </div>
            <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Save &amp; exit
            </CbButton>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <CbChip>{completeness}% complete</CbChip>
            {squares > 0 ? <CbChip>{squares.toFixed(1)} SQ</CbChip> : null}
          </div>

          {/* ROOF SYSTEM */}
          <Section title="Roof system" pct={pctOf("roof_system")}>
            <Picker
              label="Roof type"
              options={CB_ROOF_TYPES}
              value={sheet.roof_system.roof_type}
              onChange={(v) => patch("roof_system", { roof_type: v })}
            />
            {sheet.roof_system.roof_type === "Other" ? (
              <CbField
                label="Describe the roof type"
                value={sheet.roof_system.roof_type_other ?? ""}
                onChange={(e) => patch("roof_system", { roof_type_other: e.target.value })}
              />
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <CbField
                label="Stories"
                inputMode="numeric"
                value={sheet.roof_system.stories ?? ""}
                onChange={(e) =>
                  patch("roof_system", { stories: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
              <CbField
                label="Pitch"
                placeholder="6/12"
                value={sheet.roof_system.pitch ?? ""}
                onChange={(e) => patch("roof_system", { pitch: e.target.value })}
              />
              <CbField
                label="Layers"
                inputMode="numeric"
                value={sheet.roof_system.layers ?? ""}
                onChange={(e) =>
                  patch("roof_system", { layers: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </div>
            <Picker
              label="Decking type"
              options={CB_DECKING_TYPES}
              value={sheet.roof_system.decking_type}
              onChange={(v) => patch("roof_system", { decking_type: v })}
            />
            <Picker
              label="Decking condition"
              options={CB_DECKING_CONDITION}
              value={sheet.roof_system.decking_condition}
              onChange={(v) => patch("roof_system", { decking_condition: v })}
            />
          </Section>

          {/* MEASUREMENTS */}
          <Section
            title="Measurements"
            hint="Mirrored from the instant measurement. Edit anything and it is flagged rep-adjusted."
            pct={pctOf("measurements")}
          >
            <div className="grid grid-cols-2 gap-3">
              <CbField
                label="Total squares"
                inputMode="decimal"
                value={measure?.total_squares ?? ""}
                onChange={(e) => {
                  setMeasure((m) => ({ ...(m ?? {}), total_squares: Number(e.target.value || 0) }));
                  setMeasureDirty(true);
                }}
              />
              <CbField
                label="Waste %"
                inputMode="decimal"
                value={measure?.waste_pct ?? ""}
                onChange={(e) => {
                  setMeasure((m) => ({ ...(m ?? {}), waste_pct: Number(e.target.value || 0) }));
                  setMeasureDirty(true);
                }}
              />
              {CB_LINEAR_FIELDS.map((f) => (
                <CbField
                  key={f.key}
                  label={`${f.label} LF`}
                  inputMode="decimal"
                  value={(measure?.[f.key] as number | undefined) ?? ""}
                  onChange={(e) => {
                    setMeasure((m) => ({ ...(m ?? {}), [f.key]: Number(e.target.value || 0) }));
                    setMeasureDirty(true);
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <CbButton
                size="md"
                variant="secondary"
                disabled={!measureDirty}
                onClick={() => void saveMeasurement()}
              >
                {measureDirty ? "Save measurement edits" : "Saved"}
              </CbButton>
              <CbButton
                size="md"
                variant="ghost"
                onClick={() => navigate({ to: "/cb/job/$id/measure", params: { id } })}
              >
                Re-measure
              </CbButton>
            </div>
          </Section>

          {/* FLASHING */}
          <Section title="Flashing" pct={pctOf("flashing")}>
            <QtyLine
              label="Roof-to-wall"
              suffix="LF"
              itemKey="flashing_roof_to_wall"
              photos={photoCounts.flashing_roof_to_wall ?? 0}
              onCamera={openCam}
              value={sheet.flashing.roof_to_wall_lf}
              onChange={(v) => patch("flashing", { roof_to_wall_lf: v })}
            />
            <QtyLine
              label="Step flashing"
              suffix="LF"
              itemKey="flashing_step"
              photos={photoCounts.flashing_step ?? 0}
              onCamera={openCam}
              value={sheet.flashing.step_flashing_lf}
              onChange={(v) => patch("flashing", { step_flashing_lf: v })}
            />
            <QtyLine
              label="Counterflashing"
              suffix="LF"
              itemKey="flashing_counter"
              photos={photoCounts.flashing_counter ?? 0}
              onCamera={openCam}
              value={sheet.flashing.counterflashing_lf}
              onChange={(v) => patch("flashing", { counterflashing_lf: v })}
            />
            <Picker
              label="Material"
              options={CB_FLASH_MATERIALS}
              value={sheet.flashing.material}
              onChange={(v) => patch("flashing", { material: v })}
            />
            <QtyLine
              label="Chimneys"
              suffix="count"
              itemKey="chimney"
              photos={photoCounts.chimney ?? 0}
              onCamera={openCam}
              value={sheet.flashing.chimney_count}
              onChange={(v) => patch("flashing", { chimney_count: v })}
            />
            <CbField
              label="Chimney size"
              placeholder={`32" x 32"`}
              value={sheet.flashing.chimney_size ?? ""}
              onChange={(e) => patch("flashing", { chimney_size: e.target.value })}
            />
            <CbCheckbox
              label="Cricket present"
              checked={!!sheet.flashing.cricket}
              onChange={(v) => patch("flashing", { cricket: v })}
            />
          </Section>

          {/* VENTILATION */}
          <Section title="Ventilation" hint="Required NFA is calculated from the squares." pct={pctOf("ventilation")}>
            <QtyLine
              label="Ridge vent"
              suffix="LF"
              itemKey="vent_ridge"
              photos={photoCounts.vent_ridge ?? 0}
              onCamera={openCam}
              value={sheet.ventilation.ridge_vent_lf}
              onChange={(v) => patch("ventilation", { ridge_vent_lf: v })}
            />
            <QtyLine
              label="Box / turtle vents"
              suffix="qty"
              itemKey="vent_box"
              photos={photoCounts.vent_box ?? 0}
              onCamera={openCam}
              value={sheet.ventilation.box_vent_qty}
              onChange={(v) => patch("ventilation", { box_vent_qty: v })}
            />
            <QtyLine
              label="Turbines"
              suffix="qty"
              itemKey="vent_turbine"
              photos={photoCounts.vent_turbine ?? 0}
              onCamera={openCam}
              value={sheet.ventilation.turbine_qty}
              onChange={(v) => patch("ventilation", { turbine_qty: v })}
            />
            <QtyLine
              label="Power vents"
              suffix="qty"
              itemKey="vent_power"
              photos={photoCounts.vent_power ?? 0}
              onCamera={openCam}
              value={sheet.ventilation.power_vent_qty}
              onChange={(v) => patch("ventilation", { power_vent_qty: v })}
            />
            <QtyLine
              label="Solar attic fans"
              suffix="qty"
              itemKey="vent_solar_fan"
              photos={photoCounts.vent_solar_fan ?? 0}
              onCamera={openCam}
              value={sheet.ventilation.solar_fan_qty}
              onChange={(v) => patch("ventilation", { solar_fan_qty: v })}
            />
            <QtyLine
              label="Soffit vent"
              suffix="LF"
              itemKey="vent_soffit"
              photos={photoCounts.vent_soffit ?? 0}
              onCamera={openCam}
              value={sheet.ventilation.soffit_vent_lf}
              onChange={(v) => patch("ventilation", { soffit_vent_lf: v })}
            />
            <QtyLine
              label="Gable vents"
              suffix="qty"
              itemKey="vent_gable"
              photos={photoCounts.vent_gable ?? 0}
              onCamera={openCam}
              value={sheet.ventilation.gable_vent_qty}
              onChange={(v) => patch("ventilation", { gable_vent_qty: v })}
            />

            <div
              className="mt-1 rounded-[14px] p-4"
              style={{
                border: `1px solid ${vent.under ? "var(--cb-warning, #b45309)" : "var(--cb-border)"}`,
                background: vent.under ? "rgba(180,83,9,0.08)" : "transparent",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="cb-microlabel">Net free area</span>
                {vent.under ? (
                  <CbBadge tone="warning">
                    <AlertTriangle size={12} className="mr-1 inline" />
                    Under-ventilated
                  </CbBadge>
                ) : (
                  <CbBadge tone="success">Meets 1/150</CbBadge>
                )}
              </div>
              <p className="mt-2 cb-num text-[13.5px]" style={{ color: "var(--cb-text)" }}>
                Attic {vent.atticSqft.toLocaleString()} sq ft · required{" "}
                {vent.requiredNfa.toLocaleString()} sq in · provided {vent.providedNfa.toLocaleString()} sq in
              </p>
              {vent.recommendation ? (
                <p className="mt-2 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                  {vent.recommendation}
                </p>
              ) : null}
            </div>
          </Section>

          {/* PENETRATIONS */}
          <Section title="Penetrations" pct={pctOf("penetrations")}>
            {(
              [
                ["pipe_1_5", `Pipe jack 1.5"`],
                ["pipe_2", `Pipe jack 2"`],
                ["pipe_3", `Pipe jack 3"`],
                ["pipe_4", `Pipe jack 4"`],
                ["lead_boots", "Lead boots"],
                ["split_boots", "Split boots"],
                ["furnace_caps", "Furnace caps"],
                ["storm_collars", "Storm collars"],
                ["exhaust_vents", "Exhaust vents"],
                ["kitchen_vents", "Kitchen vents"],
                ["bath_vents", "Bath vents"],
                ["lineset_covers", "A/C line set covers"],
              ] as const
            ).map(([key, label]) => (
              <QtyLine
                key={key}
                label={label}
                suffix="qty"
                itemKey={`pen_${key}`}
                photos={photoCounts[`pen_${key}`] ?? 0}
                onCamera={openCam}
                value={sheet.penetrations[key]}
                onChange={(v) => patch("penetrations", { [key]: v } as Partial<CbSheet["penetrations"]>)}
              />
            ))}
          </Section>

          {/* SKYLIGHTS */}
          <Section title="Skylights" pct={pctOf("skylights")}>
            {sheet.skylights.map((row, i) => (
              <CbCard key={row.id} elevation="card" style={{ padding: 14 }}>
                <div className="flex items-center justify-between">
                  <span className="cb-microlabel">Skylight {i + 1}</span>
                  <button
                    type="button"
                    aria-label={`Remove skylight ${i + 1}`}
                    onClick={() =>
                      update((s) => ({ ...s, skylights: s.skylights.filter((r) => r.id !== row.id) }))
                    }
                    style={{ color: "var(--cb-text-muted)" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <CbField
                    label="Qty"
                    inputMode="numeric"
                    value={row.qty}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        skylights: s.skylights.map((r) =>
                          r.id === row.id ? { ...r, qty: Number(e.target.value || 0) } : r,
                        ),
                      }))
                    }
                  />
                  <CbField
                    label="Size"
                    value={row.size}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        skylights: s.skylights.map((r) =>
                          r.id === row.id ? { ...r, size: e.target.value } : r,
                        ),
                      }))
                    }
                  />
                  <CbField
                    label="Condition"
                    value={row.condition}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        skylights: s.skylights.map((r) =>
                          r.id === row.id ? { ...r, condition: e.target.value } : r,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="mt-3">
                  <Picker
                    label="Type"
                    options={CB_SKYLIGHT_TYPES}
                    value={row.type}
                    onChange={(v) =>
                      update((s) => ({
                        ...s,
                        skylights: s.skylights.map((r) => (r.id === row.id ? { ...r, type: v } : r)),
                      }))
                    }
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <CbCheckbox
                    label="Flashing kit"
                    checked={row.flashing_kit}
                    onChange={(v) =>
                      update((s) => ({
                        ...s,
                        skylights: s.skylights.map((r) =>
                          r.id === row.id ? { ...r, flashing_kit: v } : r,
                        ),
                      }))
                    }
                  />
                  <CbButton size="md" variant="ghost" onClick={() => openCam(`skylight_${i + 1}`, `Skylight ${i + 1}`)}>
                    <Camera size={16} className="mr-1 inline" />
                    Photo
                  </CbButton>
                </div>
              </CbCard>
            ))}
            <CbButton
              size="md"
              variant="secondary"
              onClick={() =>
                update((s) => ({
                  ...s,
                  skylights: [
                    ...s.skylights,
                    {
                      id: `sk_${Date.now()}`,
                      qty: 1,
                      size: "",
                      type: "Fixed",
                      condition: "",
                      flashing_kit: false,
                    },
                  ],
                }))
              }
            >
              <Plus size={16} className="mr-1 inline" />
              Add skylight
            </CbButton>
          </Section>

          {/* SOLAR */}
          <Section title="Solar" pct={pctOf("solar")}>
            <QtyLine
              label="Panel count"
              suffix="qty"
              itemKey="solar_panels"
              photos={photoCounts.solar_panels ?? 0}
              onCamera={openCam}
              value={sheet.solar.panel_count}
              onChange={(v) => patch("solar", { panel_count: v })}
            />
            <CbCheckbox
              label="Detach and reset"
              checked={!!sheet.solar.detach_reset}
              onChange={(v) => patch("solar", { detach_reset: v })}
            />
            <Picker
              label="Mounting type"
              options={["Rail", "Rail-less", "Ballasted", "Standoff"]}
              value={sheet.solar.mounting}
              onChange={(v) => patch("solar", { mounting: v })}
            />
          </Section>

          {/* GUTTERS */}
          <Section title="Gutters" pct={pctOf("gutters")}>
            <Picker
              label="Size"
              options={CB_GUTTER_SIZES}
              value={sheet.gutters.size}
              onChange={(v) => patch("gutters", { size: v })}
            />
            <Picker
              label="Material"
              options={CB_GUTTER_MATERIALS}
              value={sheet.gutters.material}
              onChange={(v) => patch("gutters", { material: v })}
            />
            <QtyLine
              label="Gutter"
              suffix="LF"
              itemKey="gutter_lf"
              photos={photoCounts.gutter_lf ?? 0}
              onCamera={openCam}
              value={sheet.gutters.lf}
              onChange={(v) => patch("gutters", { lf: v })}
            />
            <QtyLine
              label="Downspouts"
              suffix="qty"
              itemKey="downspouts"
              photos={photoCounts.downspouts ?? 0}
              onCamera={openCam}
              value={sheet.gutters.downspout_qty}
              onChange={(v) => patch("gutters", { downspout_qty: v })}
            />
            <CbField
              label="Downspout size"
              placeholder={`2" x 3"`}
              value={sheet.gutters.downspout_size ?? ""}
              onChange={(e) => patch("gutters", { downspout_size: e.target.value })}
            />
            <CbCheckbox
              label="Gutter guards"
              checked={!!sheet.gutters.guards}
              onChange={(v) => patch("gutters", { guards: v })}
            />
          </Section>

          {/* HARDWARE */}
          <Section title="Roof hardware" pct={pctOf("hardware")}>
            {(
              [
                ["satellite_dish", "Satellite dish"],
                ["antenna", "Antenna"],
                ["snow_guards", "Snow guards"],
                ["heat_cable_lf", "Heat cable (LF)"],
                ["anchors", "Anchors"],
                ["lights", "Lights"],
                ["cameras", "Cameras"],
              ] as const
            ).map(([key, label]) => (
              <QtyLine
                key={key}
                label={label}
                itemKey={`hw_${key}`}
                photos={photoCounts[`hw_${key}`] ?? 0}
                onCamera={openCam}
                value={sheet.hardware[key] as number | undefined}
                onChange={(v) => patch("hardware", { [key]: v } as Partial<CbSheet["hardware"]>)}
              />
            ))}
            <CbField
              label="Anything else on the roof"
              value={sheet.hardware.other ?? ""}
              onChange={(e) => patch("hardware", { other: e.target.value })}
            />
          </Section>

          {/* NOTES */}
          <Section title="Roof notes" pct={pctOf("notes")}>
            <CbTextarea
              label="Notes"
              rows={5}
              value={sheet.notes ?? ""}
              onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))}
            />
          </Section>

          <div className="mt-6 grid gap-2">
            <CbButton block onClick={() => navigate({ to: "/cb/job/$id/review", params: { id } })}>
              Go to review
            </CbButton>
          </div>
        </div>

        {cam ? (
          <CbCamera
            open
            onClose={() => setCam(null)}
            jobId={id}
            workspaceId={job?.job?.workspace_id}
            meta={{ category: "takeoff", item_key: cam.itemKey, shot_type: "detail" }}
            title={cam.label}
            instruction={`Photograph the ${cam.label.toLowerCase()} so the line item and the photo stay linked.`}
            captionContext={`Takeoff — ${cam.label}`}
            onSaved={() => setCam(null)}
          />
        ) : null}

        <CbPendingPill />
      </div>
    </CbSurface>
  );
}
