import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading } from "@/components/cb/primitives";
import { CbProgressRail, CbTextarea } from "@/components/cb/forms";
import { CbCamera } from "@/components/cb/CbCamera";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { CbUnifiedChecklist } from "@/components/claim-buddy/CbUnifiedChecklist";
import { CbPicker } from "@/components/claim-buddy/CbTakeoffFields";
import { useCbCatalog } from "@/lib/cbCatalog";
import { buildExteriorRows, type CbRow } from "@/lib/cbSheetRows";
import { readSheet, CB_SIDING_TYPES, type CbExteriorArea, type CbSheet } from "@/lib/cbSheet";
import {
  CB_ELEVATIONS,
  CB_ELEVATION_LABEL,
  useCbTakeoff,
  type CbElevation,
  type CbTakeoff,
} from "@/lib/cbTakeoff";

export const Route = createFileRoute("/cb/job/$id/exterior")({
  head: () => ({
    meta: [
      { title: "Exterior walk — Claim Buddy" },
      {
        name: "description",
        content:
          "One sheet per elevation: check the item, type the quantity, shoot the photo, move to the next wall.",
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
  const qc = useQueryClient();
  const { takeoff, isLoading, patchElevation, patchData, mutate } = useCbTakeoff(id);
  const { data: catalog, isLoading: catalogLoading } = useCbCatalog("exterior");
  const [idx, setIdx] = useState(0);
  const [wideCam, setWideCam] = useState(false);

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

  const sheet = useMemo(() => readSheet(takeoff.data as Record<string, unknown>), [takeoff.data]);
  const area: CbExteriorArea = (sheet.exterior ?? {})[elev] ?? {};

  const rows = useMemo(
    () => buildExteriorRows({ catalog, entries, area, photoCounts, elevationKey: elev }),
    [catalog, entries, area, photoCounts, elev],
  );

  const loggedCount = rows.reduce((n, g) => n + g.rows.filter((r) => r.selected).length, 0);

  function patchArea(part: Partial<CbExteriorArea>) {
    void patchData({
      sheet: {
        ...sheet,
        exterior: { ...(sheet.exterior ?? {}), [elev]: { ...area, ...part } },
      },
    });
  }

  /** One atomic write so a row can touch the checklist and the takeoff at once. */
  function writeRow(
    row: CbRow,
    patch: { selected?: boolean; qty?: number | null; note?: string; shot?: "medium" | "close"; count?: number },
  ) {
    void mutate((prev): Omit<CbTakeoff, "job_id"> => {
      const prevSheet = readSheet(prev.data as Record<string, unknown>) as CbSheet;
      const prevElev = prev.elevations[elev] ?? {};
      const items = { ...(prevElev.items ?? {}) };
      const prevArea = { ...((prevSheet.exterior ?? {})[elev] ?? {}) } as Record<string, unknown>;

      if (row.catalogKey) {
        const existing = items[row.catalogKey];
        if (patch.selected === false) {
          delete items[row.catalogKey];
        } else {
          const next = { ...(existing ?? {}) };
          if (patch.selected === true && !existing) Object.assign(next, {});
          if (patch.qty !== undefined) next.qty = patch.qty;
          if (patch.note !== undefined) next.note = patch.note;
          if (patch.shot && patch.count) {
            next[patch.shot] = ((next[patch.shot] ?? 0) as number) + patch.count;
          }
          items[row.catalogKey] = next;
        }
      }

      if (row.fieldKey) {
        if (patch.selected === false) delete prevArea[row.fieldKey];
        if (patch.qty !== undefined) prevArea[row.fieldKey] = patch.qty ?? undefined;
      }

      return {
        data: {
          ...prev.data,
          sheet: {
            ...prevSheet,
            exterior: { ...(prevSheet.exterior ?? {}), [elev]: prevArea as CbExteriorArea },
          },
        },
        elevations: {
          ...prev.elevations,
          [elev]: { ...prevElev, items, cleared: false },
        },
      };
    });
  }

  const railSteps = useMemo(() => CB_ELEVATIONS.map((e) => CB_ELEVATION_LABEL[e]), []);

  async function completeElevation() {
    await patchElevation(elev, { done: true, cleared: loggedCount === 0 });
    if (idx < CB_ELEVATIONS.length - 1) {
      setIdx(idx + 1);
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
      <div className="min-h-screen px-4 pb-32 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <CbProgressRail steps={railSteps} current={idx} />

          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                {label} elevation
              </h1>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Check what&apos;s damaged, type the quantity, shoot it — one pass.
              </p>
            </div>
            <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Save &amp; exit
            </CbButton>
          </div>

          {/* the wide shot, always required */}
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

          <CbCard elevation="card" className="mt-3" style={{ padding: 16 }}>
            <CbPicker
              label="Siding type"
              options={CB_SIDING_TYPES}
              value={area.siding_type}
              onChange={(v) => patchArea({ siding_type: v })}
            />
          </CbCard>

          <div className="mt-3">
            <CbUnifiedChecklist
              groups={rows}
              isLoading={catalogLoading}
              jobId={id}
              workspaceId={job?.workspace_id as string | undefined}
              contextLabel={`${label} elevation`}
              contextKey={elev}
              onToggle={(row, next) => writeRow(row, { selected: next })}
              onQty={(row, value) => writeRow(row, { qty: value, selected: true })}
              onNote={(row, value) => writeRow(row, { note: value })}
              onShot={(row, kind, count) => {
                if (kind === "detail") {
                  void qc.invalidateQueries({ queryKey: ["cb-ext-takeoff-photos", id] });
                  return;
                }
                writeRow(row, { selected: true, shot: kind, count });
              }}
            />
          </div>

          <CbCard elevation="card" className="mt-3" style={{ padding: 16 }}>
            <CbTextarea
              label={`${label} notes`}
              rows={3}
              value={area.notes ?? ""}
              onChange={(e) => patchArea({ notes: e.target.value })}
            />
          </CbCard>

          <div aria-hidden className="cb-has-dock" />
          <div className="cb-dock">
            <div className="mx-auto flex w-full max-w-[620px] items-center gap-2">
              <CbButton block onClick={completeElevation}>
                {idx < CB_ELEVATIONS.length - 1
                  ? `Complete ${label.toLowerCase()} — next elevation`
                  : "Finish exterior inspection"}
              </CbButton>
            </div>
          </div>
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

        <CbPendingPill />
      </div>
    </CbSurface>
  );
}
