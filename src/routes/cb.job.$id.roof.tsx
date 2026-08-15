import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading } from "@/components/cb/primitives";
import { CbProgressRail, CbStepper } from "@/components/cb/forms";
import { CbCamera } from "@/components/cb/CbCamera";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { CbDamageChecklist } from "@/components/claim-buddy/CbDamageChecklist";
import {
  CB_ELEVATIONS,
  CB_ELEVATION_LABEL,
  useCbTakeoff,
  type CbElevation,
} from "@/lib/cbTakeoff";
import { readSheet, type CbSheet } from "@/lib/cbSheet";
import { CbRoofTakeoffFields } from "@/components/claim-buddy/CbTakeoffFields";



export const Route = createFileRoute("/cb/job/$id/roof")({
  head: () => ({
    meta: [
      { title: "Roof walk — Claim Buddy" },
      {
        name: "description",
        content:
          "Guided roof walk: safety and access, a wide shot of every slope, chalked test squares and hardware photos.",
      },
      { property: "og:title", content: "Roof walk — Claim Buddy" },
      { property: "og:description", content: "Every slope documented, clean ones included." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbRoofWalk,
});

const ACCESS_POINTS = ["Front ladder", "Rear ladder", "Garage", "Deck / patio", "Interior hatch"];
const PITCHES = ["3/12", "4/12", "5/12", "6/12", "7/12", "8/12", "9/12", "10/12", "12/12"];

function pitchIsSteep(pitch?: string) {
  const rise = Number((pitch ?? "").split("/")[0]);
  return Number.isFinite(rise) && rise >= 8;
}

function CbRoofWalk() {
  const { id } = useParams({ from: "/cb/job/$id/roof" });
  const navigate = useNavigate();
  const { takeoff, isLoading, patchElevation, patchItem, patchData } = useCbTakeoff(id);
  const [safetyDone, setSafetyDone] = useState(false);
  const [idx, setIdx] = useState(0);
  const [cam, setCam] = useState<null | "wide" | "test_square">(null);
  const [takeoffCam, setTakeoffCam] = useState<{ itemKey: string; label: string } | null>(null);
  const [phase, setPhase] = useState<"slopes" | "takeoff">("slopes");
  const [hits, setHits] = useState(0);


  const { data: job } = useQuery({
    queryKey: ["cb-job-ws", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cb_jobs")
        .select("id, workspace_id")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const safety = takeoff.data.safety ?? {};

  /** Safety answers are the takeoff sheet's answers — never ask twice. */
  function patchSafety(part: { stories?: number; access?: string; pitch?: string }) {
    const nextSafety = { ...safety, ...part };
    const sheet = readSheet(takeoff.data as Record<string, unknown>);
    void patchData({
      safety: nextSafety,
      sheet: {
        ...sheet,
        roof_system: {
          ...sheet.roof_system,
          stories: nextSafety.stories ?? sheet.roof_system.stories,
          pitch: nextSafety.pitch ?? sheet.roof_system.pitch,
        },
      },
    });
  }

  /* ---- the takeoff sheet, now the last step of the walk ---- */
  const sheet = useMemo(() => readSheet(takeoff.data as Record<string, unknown>), [takeoff.data]);

  const { data: takeoffPhotos } = useQuery({
    queryKey: ["cb-roof-takeoff-photos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cb_photos")
        .select("item_key")
        .eq("job_id", id)
        .eq("category", "takeoff");
      return data ?? [];
    },
  });

  const photoCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of takeoffPhotos ?? []) {
      const k = (p as { item_key: string | null }).item_key ?? "";
      if (k) map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [takeoffPhotos]);

  function patchSheet<K extends keyof CbSheet>(key: K, part: Partial<CbSheet[K]>) {
    void patchData({
      sheet: { ...sheet, [key]: { ...(sheet[key] as object), ...part } },
    });
  }



  const elev = CB_ELEVATIONS[idx] as CbElevation;
  const label = CB_ELEVATION_LABEL[elev];
  const state = takeoff.elevations[elev] ?? {};
  const squares = state.testSquares ?? [];
  const tally = squares.reduce((n, s) => n + s.hits, 0);
  const railSteps = useMemo(
    () => ["Safety", ...CB_ELEVATIONS.map((e) => `${CB_ELEVATION_LABEL[e]} slope`), "Takeoff"],
    [],
  );
  const missingWide = CB_ELEVATIONS.filter((e) => !(takeoff.elevations[e]?.slopeWide ?? 0));


  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Loading the roof walk…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  if (!safetyDone) {
    return (
      <CbSurface>
        <div className="min-h-screen px-4 py-8" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto w-full max-w-[620px]">
            <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
              Safety &amp; access
            </h1>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
              Before you go up.
            </p>

            <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
              <div className="grid gap-4">
                <CbStepper
                  label="Stories"
                  value={safety.stories ?? 1}
                  min={1}
                  max={4}
                  onChange={(v) => patchSafety({ stories: v })}
                />
                <div>
                  <span className="cb-microlabel">Access point</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ACCESS_POINTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`cb-pick ${safety.access === a ? "is-on" : ""}`}
                        onClick={() => patchSafety({ access: a })}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="cb-microlabel">Pitch</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PITCHES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`cb-pick cb-num ${safety.pitch === p ? "is-on" : ""}`}
                        onClick={() => patchSafety({ pitch: p })}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                </div>

                {pitchIsSteep(safety.pitch) ? (
                  <div className="cb-warn" role="alert">
                    <AlertTriangle size={18} />
                    <span>Steep — rope up.</span>
                  </div>
                ) : null}
              </div>
            </CbCard>

            <div className="mt-5 grid gap-2">
              <CbButton block onClick={() => setSafetyDone(true)}>
                Start the roof walk
              </CbButton>
              <CbButton block variant="ghost" onClick={() => navigate({ to: "/cb" })}>
                Save &amp; exit
              </CbButton>
            </div>
          </div>
          <CbPendingPill />
        </div>
      </CbSurface>
    );
  }

  if (phase === "takeoff") {
    return (
      <CbSurface>
        <div className="min-h-screen px-4 pb-32 pt-6" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto w-full max-w-[620px]">
            <CbProgressRail steps={railSteps} current={railSteps.length - 1} />

            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                  Roof takeoff
                </h1>
                <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                  Quantity or a photo on every line — this is what the estimate reads.
                </p>
              </div>
              <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb" })}>
                Save &amp; exit
              </CbButton>
            </div>

            <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
              <span className="cb-microlabel">Roof measurement</span>
              <p className="mt-2 text-[15px]" style={{ color: "var(--cb-text)" }}>
                Drop a pin and pull the footprint — squares, eaves and rakes fill the takeoff for
                you.
              </p>
              <div className="mt-4">
                <CbButton
                  block
                  variant="secondary"
                  onClick={() => navigate({ to: "/cb/job/$id/measure", params: { id } })}
                >
                  Measure this roof
                </CbButton>
              </div>
            </CbCard>

            <CbRoofTakeoffFields
              sheet={sheet}
              onPatch={patchSheet}
              onNotes={(v) => void patchData({ sheet: { ...sheet, notes: v } })}
              onCamera={(itemKey, label) => setTakeoffCam({ itemKey, label })}
              photoCounts={photoCounts}
            />

            <div aria-hidden className="cb-has-dock" />
            <div className="cb-dock">
              <div className="mx-auto flex w-full max-w-[620px] items-center gap-2">
                <CbButton block onClick={() => navigate({ to: "/cb/job/$id/scope", params: { id } })}>
                  <CheckCircle2 size={16} className="mr-2 inline" /> Finish roof inspection
                </CbButton>
                <CbButton variant="ghost" size="md" onClick={() => navigate({ to: "/cb" })}>
                  Save &amp; exit
                </CbButton>
              </div>
            </div>
          </div>

          {takeoffCam ? (
            <CbCamera
              open
              jobId={id}
              workspaceId={job?.workspace_id as string | undefined}
              meta={{ category: "takeoff", item_key: takeoffCam.itemKey, shot_type: "detail" }}
              title={takeoffCam.label}
              instruction={`Photograph the ${takeoffCam.label.toLowerCase()} so the line item and the photo stay linked.`}
              captionContext={`Takeoff — ${takeoffCam.label}`}
              onSaved={() => setTakeoffCam(null)}
              onClose={() => setTakeoffCam(null)}

            />
          ) : null}

          <CbPendingPill />
        </div>
      </CbSurface>
    );
  }



  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-28 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <CbProgressRail steps={railSteps} current={idx + 1} />

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                {label} slope
              </h1>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Clockwise from the front left corner{safety.pitch ? ` · ${safety.pitch}` : ""}.
              </p>
            </div>
            <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Save &amp; exit
            </CbButton>
          </div>

          {/* b) wide shot of every slope, clean ones included */}
          <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
            <div className="flex items-center justify-between gap-3">
              <span className="cb-microlabel">Slope wide shot</span>
              {state.slopeWide ? (
                <CbBadge tone="success">
                  <CheckCircle2 size={13} className="mr-1 inline" />
                  {state.slopeWide} captured
                </CbBadge>
              ) : (
                <CbBadge tone="warning">Required</CbBadge>
              )}
            </div>
            <p className="mt-2 text-[15px]" style={{ color: "var(--cb-text)" }}>
              Shoot the whole {label.toUpperCase()} slope — even if it&apos;s clean.
            </p>
            <div className="mt-4">
              <CbButton block variant={state.slopeWide ? "secondary" : "primary"} onClick={() => setCam("wide")}>
                <Camera size={16} className="mr-2 inline" /> Shoot the slope
              </CbButton>
            </div>
          </CbCard>

          {/* c) test squares */}
          <CbCard elevation="raised" className="mt-3" style={{ padding: 20 }}>
            <div className="flex items-center justify-between gap-3">
              <span className="cb-microlabel">Test squares</span>
              <CbBadge tone={tally > 0 ? "accent" : "neutral"}>
                {squares.length} {squares.length === 1 ? "square" : "squares"} · {tally} hits
              </CbBadge>
            </div>
            <p className="mt-2 text-[15px]" style={{ color: "var(--cb-text)" }}>
              Chalk a 10x10 test square, circle each impact, shoot it.
            </p>
            <div className="mt-3">
              <CbStepper label="Hits in this square" value={hits} min={0} max={200} onChange={setHits} />
            </div>
            <div className="mt-3">
              <CbButton block variant="secondary" onClick={() => setCam("test_square")}>
                <Plus size={16} className="mr-2 inline" /> Shoot this test square
              </CbButton>
            </div>
            {squares.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {squares.map((s, i) => (
                  <span key={i} className="cb-chip cb-num">
                    #{i + 1} · {s.hits} hits
                  </span>
                ))}
              </div>
            ) : null}
          </CbCard>

          {/* d) vents, caps, flashing runs, skylights */}
          <div className="mt-4">
            <span className="cb-microlabel">Penetrations, vents, flashing &amp; skylights</span>
            <div className="mt-2">
              <CbDamageChecklist
                scope="roof"
                jobId={id}
                workspaceId={job?.workspace_id as string | undefined}
                elevationKey={elev}
                elevationLabel={`${label} slope`}
                entries={state.roofItems ?? {}}
                photoCategory="roof"
                onShot={(itemKey, kind, count) =>
                  void patchItem(elev, "roofItems", itemKey, {
                    [kind]: ((state.roofItems?.[itemKey]?.[kind] ?? 0) as number) + count,
                  })
                }
                onEntry={(itemKey, patch) => void patchItem(elev, "roofItems", itemKey, patch)}
                onRemove={(itemKey) => void patchItem(elev, "roofItems", itemKey, null)}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            {idx < CB_ELEVATIONS.length - 1 ? (
              <CbButton
                block
                disabled={!state.slopeWide}
                onClick={() => {
                  setIdx(idx + 1);
                  setHits(0);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {state.slopeWide ? "Next slope" : "Wide shot required"}
              </CbButton>
            ) : (
              <CbButton
                block
                disabled={missingWide.length > 0}
                onClick={() => {
                  setPhase("takeoff");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}

              >
                {missingWide.length > 0
                  ? `Missing wide shot: ${missingWide.map((e) => CB_ELEVATION_LABEL[e]).join(", ")}`
                  : "Continue to roof takeoff"}
              </CbButton>

            )}
          </div>
        </div>

        {cam ? (
          <CbCamera
            open
            jobId={id}
            workspaceId={job?.workspace_id as string | undefined}
            title={cam === "wide" ? `${label} slope — wide` : `${label} slope — test square`}
            instruction={
              cam === "wide"
                ? `Shoot the whole ${label.toUpperCase()} slope.`
                : "Get the chalked square square-on with every circled impact readable."
            }
            captionContext={
              cam === "wide"
                ? `${label} slope — wide`
                : `${label} slope — test square — ${hits} hits`
            }
            meta={{ category: "roof", elevation: elev, shot_type: cam }}
            onSaved={async (count) => {
              if (cam === "wide") {
                await patchElevation(elev, { slopeWide: (state.slopeWide ?? 0) + count });
              } else {
                await patchElevation(elev, {
                  testSquares: [...squares, { hits, at: new Date().toISOString() }],
                });
                setHits(0);
              }
            }}
            onClose={() => setCam(null)}
          />
        ) : null}

        <CbPendingPill />
      </div>
    </CbSurface>
  );
}
