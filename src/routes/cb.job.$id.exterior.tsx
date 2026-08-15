import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading } from "@/components/cb/primitives";
import { CbProgressRail } from "@/components/cb/forms";
import { CbCamera } from "@/components/cb/CbCamera";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { CbDamageChecklist } from "@/components/claim-buddy/CbDamageChecklist";
import { CbExteriorTakeoffFields } from "@/components/claim-buddy/CbTakeoffFields";
import { readSheet, type CbExteriorArea } from "@/lib/cbSheet";
import {
  CB_ELEVATIONS,
  CB_ELEVATION_LABEL,
  useCbTakeoff,
  type CbElevation,
} from "@/lib/cbTakeoff";


export const Route = createFileRoute("/cb/job/$id/exterior")({
  head: () => ({
    meta: [
      { title: "Exterior walk — Claim Buddy" },
      {
        name: "description",
        content:
          "Guided elevation-by-elevation exterior walk: wide shots, damage checklist and two-shot documentation.",
      },
      { property: "og:title", content: "Exterior walk — Claim Buddy" },
      { property: "og:description", content: "Walk the building clockwise from the front left corner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbExteriorWalk,
});

function CbExteriorWalk() {
  const { id } = useParams({ from: "/cb/job/$id/exterior" });
  const navigate = useNavigate();
  const { takeoff, isLoading, patchElevation, patchItem, patchData } = useCbTakeoff(id);
  const [idx, setIdx] = useState(0);
  const [wideCam, setWideCam] = useState(false);
  const [takeoffCam, setTakeoffCam] = useState<{ itemKey: string; label: string } | null>(null);
  const [mode, setMode] = useState<"choice" | "damage" | "takeoff" | "summary">("choice");

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

  const { data: takeoffPhotos } = useQuery({
    queryKey: ["cb-ext-takeoff-photos", id],
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

  const elev = CB_ELEVATIONS[idx] as CbElevation;
  const label = CB_ELEVATION_LABEL[elev];
  const state = takeoff.elevations[elev] ?? {};
  const entries = state.items ?? {};
  const itemCount = Object.keys(entries).length;

  const sheet = useMemo(() => readSheet(takeoff.data as Record<string, unknown>), [takeoff.data]);
  const area = (sheet.exterior ?? {})[elev] ?? {};

  function patchArea(part: Partial<CbExteriorArea>) {
    void patchData({
      sheet: {
        ...sheet,
        exterior: { ...(sheet.exterior ?? {}), [elev]: { ...area, ...part } },
      },
    });
  }

  const railSteps = useMemo(() => CB_ELEVATIONS.map((e) => CB_ELEVATION_LABEL[e]), []);


  function next() {
    if (idx < CB_ELEVATIONS.length - 1) {
      setIdx(idx + 1);
      setMode("choice");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate({ to: "/cb/job/$id/scope", params: { id } });
    }
  }

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Loading the exterior walk…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-28 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <CbProgressRail steps={railSteps} current={idx} />

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                {label} elevation
              </h1>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Start at the front left corner and walk clockwise.
              </p>
            </div>
            <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Save &amp; exit
            </CbButton>
          </div>

          {/* a) the wide shot, always required */}
          <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
            <div className="flex items-center justify-between gap-3">
              <span className="cb-microlabel">Wide shot</span>
              {state.wide ? (
                <CbBadge tone="success">
                  <CheckCircle2 size={13} className="mr-1 inline" />
                  {state.wide} captured
                </CbBadge>
              ) : (
                <CbBadge tone="warning">Required</CbBadge>
              )}
            </div>
            <p className="mt-2 text-[15px]" style={{ color: "var(--cb-text)" }}>
              Stand back and shoot the full {label.toUpperCase()} elevation.
            </p>
            <div className="mt-4">
              <CbButton block variant={state.wide ? "secondary" : "primary"} onClick={() => setWideCam(true)}>
                <Camera size={16} className="mr-2 inline" />
                {state.wide ? "Shoot another wide" : "Shoot the wide"}
              </CbButton>
            </div>
          </CbCard>

          {/* b) clear it, or log damage — never gated on the camera working */}
          {true ? (

            mode === "damage" ? (
              <div className="mt-4">
                <CbDamageChecklist
                  scope="exterior"
                  jobId={id}
                  workspaceId={job?.workspace_id as string | undefined}
                  elevationKey={elev}
                  elevationLabel={label}
                  entries={entries}
                  photoCategory="exterior"
                  onShot={(itemKey, kind, count) =>
                    void patchItem(elev, "items", itemKey, {
                      [kind]: ((entries[itemKey]?.[kind] ?? 0) as number) + count,
                    })
                  }
                  onEntry={(itemKey, patch) => void patchItem(elev, "items", itemKey, patch)}
                  onRemove={(itemKey) => void patchItem(elev, "items", itemKey, null)}
                />
                <div className="mt-4">
                  <CbButton block onClick={() => setMode("takeoff")}>
                    Done with {label} — takeoff
                  </CbButton>
                </div>
              </div>
            ) : mode === "takeoff" ? (
              <div className="mt-2">
                <CbExteriorTakeoffFields
                  elevationKey={elev}
                  elevationLabel={label}
                  area={area}
                  onPatch={patchArea}
                  onCamera={(itemKey, itemLabel) => setTakeoffCam({ itemKey, label: itemLabel })}
                  photoCounts={photoCounts}
                />
                <div className="mt-4 grid gap-2">
                  <CbButton block onClick={() => setMode("summary")}>
                    Done with {label}
                  </CbButton>
                  <CbButton block variant="ghost" onClick={() => setMode("damage")}>
                    Back to the checklist
                  </CbButton>
                </div>
              </div>
            ) : mode === "summary" ? (
              <CbCard elevation="floating" className="mt-4" style={{ padding: 20 }}>
                <span className="cb-microlabel">{label} summary</span>
                <p className="mt-2 text-[15px]" style={{ color: "var(--cb-text)" }}>
                  {state.cleared
                    ? "No damage logged — the wide shot stays on file so the adjuster can see it was checked."
                    : `${itemCount} ${itemCount === 1 ? "item" : "items"} logged, ${state.wide} wide ${
                        state.wide === 1 ? "shot" : "shots"
                      }.`}
                </p>
                <div className="mt-4 grid gap-2">
                  <CbButton block onClick={next}>
                    {idx < CB_ELEVATIONS.length - 1 ? "Next elevation" : "Finish exterior inspection"}
                  </CbButton>
                  <CbButton block variant="secondary" onClick={() => setMode("takeoff")}>
                    Open the {label.toLowerCase()} takeoff
                  </CbButton>
                  <CbButton block variant="ghost" onClick={() => setMode("damage")}>
                    Back to the checklist
                  </CbButton>
                </div>
              </CbCard>
            ) : (
              <div className="mt-4 grid gap-2">
                <CbButton
                  block
                  variant="secondary"
                  onClick={async () => {
                    await patchElevation(elev, { cleared: true, done: true });
                    setMode("takeoff");
                  }}
                >
                  No damage on this elevation
                </CbButton>
                <CbButton
                  block
                  onClick={async () => {
                    await patchElevation(elev, { cleared: false });
                    setMode("damage");
                  }}
                >
                  Log damage
                </CbButton>
                <CbButton block variant="secondary" onClick={() => setMode("takeoff")}>
                  Go straight to the takeoff
                </CbButton>
                <CbButton block variant="ghost" onClick={next}>
                  Skip this elevation
                </CbButton>
              </div>

            )

          ) : null}
        </div>

        {wideCam ? (
          <CbCamera
            open
            jobId={id}
            workspaceId={job?.workspace_id as string | undefined}
            title={`${label} elevation — wide`}
            instruction={`Stand back and shoot the full ${label.toUpperCase()} elevation.`}
            captionContext={`${label} elevation — wide`}
            meta={{ category: "exterior", elevation: elev, shot_type: "wide" }}
            onSaved={(count) => void patchElevation(elev, { wide: (state.wide ?? 0) + count })}
            onClose={() => setWideCam(false)}
          />
        ) : null}

        {takeoffCam ? (
          <CbCamera
            open
            jobId={id}
            workspaceId={job?.workspace_id as string | undefined}
            title={takeoffCam.label}
            instruction={`Photograph the ${takeoffCam.label.toLowerCase()} on the ${label.toUpperCase()} elevation.`}
            captionContext={`${label} elevation takeoff — ${takeoffCam.label}`}
            meta={{ category: "takeoff", item_key: takeoffCam.itemKey, shot_type: "detail" }}
            onSaved={() => setTakeoffCam(null)}
            onClose={() => setTakeoffCam(null)}
          />
        ) : null}



        <CbPendingPill />
      </div>
    </CbSurface>
  );
}
