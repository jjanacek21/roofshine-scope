import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Ruler } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading } from "@/components/cb/primitives";
import { CbTextarea } from "@/components/cb/forms";
import { CbCamera } from "@/components/cb/CbCamera";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { CbPicker } from "@/components/claim-buddy/CbTakeoffFields";
import { useCbCatalog } from "@/lib/cbCatalog";
import { buildRoofRows, type CbRow } from "@/lib/cbSheetRows";
import {
  CB_ELEVATIONS,
  CB_ELEVATION_LABEL,
  useCbTakeoff,
  type CbElevation,
  type CbItemEntry,
  type CbTakeoff,
} from "@/lib/cbTakeoff";
import {
  readSheet,
  CB_ROOF_TYPES,
  CB_DECKING_TYPES,
  CB_DECKING_CONDITION,
  type CbSheet,
} from "@/lib/cbSheet";

export const Route = createFileRoute("/cb/job/$id/roof")({
  head: () => ({
    meta: [
      { title: "Roof takeoff — Claim Buddy" },
      {
        name: "description",
        content:
          "One roof screen: four elevation wide shots, the full hardware checklist and close-ups — no slope-by-slope wizard.",
      },
      { property: "og:title", content: "Roof takeoff — Claim Buddy" },
      { property: "og:description", content: "Wide shots, hardware, close-ups. One screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbRoofTakeoff,
});

function CbRoofTakeoff() {
  const { id } = useParams({ from: "/cb/job/$id/roof" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { takeoff, isLoading, patchElevation, patchData, mutate } = useCbTakeoff(id);
  const { data: catalog, isLoading: catalogLoading } = useCbCatalog("roof");

  const [wideCam, setWideCam] = useState<CbElevation | null>(null);
  const [closeCam, setCloseCam] = useState<null | { key: string | null; label: string }>(null);

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

  /* ---------------- the measurement must happen here ---------------- */
  const { data: measurement, isLoading: measureLoading } = useQuery({
    queryKey: ["cb-roof-measurement", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cb_measurements")
        .select("total_squares, total_area_sqft, pitch, facets")
        .eq("job_id", id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const measured = Number(measurement?.total_squares ?? 0) > 0;
  const sentToMeasure = useRef(false);

  useEffect(() => {
    if (measureLoading || measured || sentToMeasure.current) return;
    sentToMeasure.current = true;
    navigate({ to: "/cb/job/$id/measure", params: { id } });
  }, [measureLoading, measured, id, navigate]);

  const sheet = useMemo(() => readSheet(takeoff.data as Record<string, unknown>), [takeoff.data]);
  const hardware = (takeoff.data.roofHardware ?? {}) as Record<string, CbItemEntry>;

  function patchSheet<K extends keyof CbSheet>(key: K, part: Partial<CbSheet[K]>) {
    void patchData({ sheet: { ...sheet, [key]: { ...(sheet[key] as object), ...part } } });
  }

  const { data: roofPhotos } = useQuery({
    queryKey: ["cb-roof-photos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("cb_photos")
        .select("item_key, shot_type")
        .eq("job_id", id)
        .eq("category", "roof");
      return data ?? [];
    },
  });

  const photoCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of roofPhotos ?? []) {
      const k = (p as { item_key: string | null }).item_key ?? "";
      if (k) map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [roofPhotos]);

  const closeUps = (roofPhotos ?? []).filter(
    (p) => (p as { shot_type: string | null }).shot_type === "detail",
  ).length;

  /** Flat list — every roof hardware and accessory item, all visible at once. */
  const rows = useMemo(
    () =>
      buildRoofRows({ catalog, entries: hardware, sheet, photoCounts }).flatMap((g) => g.rows),
    [catalog, hardware, sheet, photoCounts],
  );

  const selectedRows = rows.filter((r) => r.selected);

  /** One atomic write per row: hardware selection + roof takeoff quantity. */
  function writeRow(row: CbRow, patch: { selected?: boolean; qty?: number | null }) {
    void mutate((prev): Omit<CbTakeoff, "job_id"> => {
      const prevSheet = readSheet(prev.data as Record<string, unknown>) as CbSheet;
      const items = { ...((prev.data.roofHardware ?? {}) as Record<string, CbItemEntry>) };

      if (row.catalogKey) {
        if (patch.selected === false) {
          delete items[row.catalogKey];
        } else {
          const next = { ...(items[row.catalogKey] ?? {}) };
          if (patch.qty !== undefined) next.qty = patch.qty;
          items[row.catalogKey] = next;
        }
      }

      let nextSheet = prevSheet;
      if (row.sheetSection && row.sheetKey) {
        const section = { ...((prevSheet[row.sheetSection] ?? {}) as Record<string, unknown>) };
        if (patch.selected === false) delete section[row.sheetKey];
        if (patch.qty !== undefined) section[row.sheetKey] = patch.qty ?? undefined;
        nextSheet = { ...prevSheet, [row.sheetSection]: section } as CbSheet;
      }

      return {
        data: { ...prev.data, sheet: nextSheet, roofHardware: items },
        elevations: prev.elevations,
      };
    });
  }

  if (isLoading || measureLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Loading the roof takeoff…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  const missingWide = CB_ELEVATIONS.filter((e) => !(takeoff.elevations[e]?.slopeWide ?? 0));

  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-32 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                Roof takeoff
              </h1>
              <p className="mt-1 text-[15px]" style={{ color: "var(--cb-text-muted)" }}>
                Wide shots, hardware, close-ups. One screen.
              </p>
            </div>
            <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Save &amp; exit
            </CbButton>
          </div>

          {/* measurement — required, never skipped */}
          <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
            <div className="flex items-center justify-between gap-3">
              <span className="cb-microlabel">Measurement</span>
              {measured ? (
                <CbBadge tone="success">
                  <CheckCircle2 size={13} className="mr-1 inline" />
                  {Number(measurement?.total_squares ?? 0).toFixed(1)} SQ
                </CbBadge>
              ) : (
                <CbBadge tone="warning">Required</CbBadge>
              )}
            </div>
            <p className="mt-2 text-[15px]" style={{ color: "var(--cb-text)" }}>
              {measured
                ? `${Number(measurement?.total_area_sqft ?? 0).toLocaleString()} sq ft${
                    measurement?.pitch ? ` · ${measurement.pitch}` : ""
                  }${measurement?.facets ? ` · ${measurement.facets} facets` : ""}`
                : "Drop a pin on the roof and measure before you take it off."}
            </p>
            <div className="mt-3">
              <CbButton
                block
                variant={measured ? "secondary" : "primary"}
                onClick={() => navigate({ to: "/cb/job/$id/measure", params: { id } })}
              >
                <Ruler size={16} className="mr-2 inline" />
                {measured ? "Open the measurement" : "Measure this roof"}
              </CbButton>
            </div>
          </CbCard>

          {/* roof system — drives the estimate assembly */}
          <CbCard elevation="raised" className="mt-3" style={{ padding: 20 }}>
            <span className="cb-microlabel">Roof system</span>
            <div className="mt-3 grid gap-3">
              <CbPicker
                label="Roof type"
                options={CB_ROOF_TYPES}
                value={sheet.roof_system.roof_type}
                onChange={(v) => patchSheet("roof_system", { roof_type: v })}
              />
              <CbPicker
                label="Decking"
                options={CB_DECKING_TYPES}
                value={sheet.roof_system.decking_type}
                onChange={(v) => patchSheet("roof_system", { decking_type: v })}
              />
              <CbPicker
                label="Decking condition"
                options={CB_DECKING_CONDITION}
                value={sheet.roof_system.decking_condition}
                onChange={(v) => patchSheet("roof_system", { decking_condition: v })}
              />
            </div>
          </CbCard>

          {/* BLOCK 1 — elevation wide shots */}
          <CbCard elevation="raised" className="mt-3" style={{ padding: 20 }}>
            <div className="flex items-center justify-between gap-3">
              <span className="cb-microlabel">1 · Elevation wide shots</span>
              <CbBadge tone={missingWide.length ? "warning" : "success"}>
                {4 - missingWide.length}/4
              </CbBadge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CB_ELEVATIONS.map((e) => {
                const count = takeoff.elevations[e]?.slopeWide ?? 0;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setWideCam(e)}
                    className="rounded-[14px] px-3 py-4 text-left"
                    style={{
                      minHeight: 88,
                      border: `1px solid var(--cb-border)`,
                      background: count ? "var(--cb-surface-2, var(--cb-surface))" : "var(--cb-surface)",
                    }}
                  >
                    <span className="block text-[16px] font-semibold" style={{ color: "var(--cb-text)" }}>
                      {CB_ELEVATION_LABEL[e]}
                    </span>
                    <span className="mt-1 block text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                      {count ? `${count} photo${count === 1 ? "" : "s"}` : "Tap to shoot"}
                    </span>
                  </button>
                );
              })}
            </div>
          </CbCard>

          {/* BLOCK 2 — roof hardware checklist */}
          <CbCard elevation="raised" className="mt-3" style={{ padding: 20 }}>
            <div className="flex items-center justify-between gap-3">
              <span className="cb-microlabel">2 · Roof hardware</span>
              <CbBadge tone={selectedRows.length ? "accent" : "neutral"}>
                {selectedRows.length} selected
              </CbBadge>
            </div>
            {catalogLoading ? (
              <div className="mt-3">
                <CbLoading label="Loading the hardware list…" />
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {rows.map((row) => {
                  const on = row.selected;
                  return (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 rounded-[14px] px-3 py-2"
                      style={{ border: `1px solid var(--cb-border)`, minHeight: 52 }}
                    >
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => writeRow(row, { selected: !on })}
                        className="flex-1 text-left text-[16px] font-semibold"
                        style={{ color: on ? "var(--cb-accent)" : "var(--cb-text)", minHeight: 44 }}
                      >
                        {on ? "✓ " : ""}
                        {row.label}
                        {row.unit ? (
                          <span className="ml-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                            {row.unit}
                          </span>
                        ) : null}
                      </button>
                      {on ? (
                        <input
                          inputMode="decimal"
                          aria-label={`${row.label} quantity`}
                          value={row.qty ?? ""}
                          placeholder="Qty"
                          onChange={(ev) => {
                            const v = ev.target.value.trim();
                            writeRow(row, { qty: v === "" ? null : Number(v), selected: true });
                          }}
                          className="cb-num rounded-[10px] px-2 text-right"
                          style={{
                            width: 82,
                            height: 44,
                            fontSize: 16,
                            border: `1px solid var(--cb-border)`,
                            background: "var(--cb-surface)",
                            color: "var(--cb-text)",
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CbCard>

          {/* BLOCK 3 — close-ups */}
          <CbCard elevation="raised" className="mt-3" style={{ padding: 20 }}>
            <div className="flex items-center justify-between gap-3">
              <span className="cb-microlabel">3 · Close-ups</span>
              <CbBadge tone={closeUps ? "success" : "neutral"}>{closeUps} shot</CbBadge>
            </div>
            <p className="mt-2 text-[15px]" style={{ color: "var(--cb-text)" }}>
              Close-ups of the hardware you selected and of the damage.
            </p>
            <div className="mt-3 grid gap-2">
              <CbButton
                block
                variant="primary"
                onClick={() => setCloseCam({ key: null, label: "General damage" })}
              >
                <Camera size={16} className="mr-2 inline" /> Shoot general damage
              </CbButton>
              {selectedRows.map((row) => (
                <CbButton
                  key={`cam-${row.id}`}
                  block
                  variant="secondary"
                  onClick={() => setCloseCam({ key: row.catalogKey ?? row.id, label: row.label })}
                >
                  <Camera size={16} className="mr-2 inline" /> {row.label}
                  {row.photos ? ` · ${row.photos}` : ""}
                </CbButton>
              ))}
            </div>
          </CbCard>

          <CbCard elevation="card" className="mt-3" style={{ padding: 16 }}>
            <CbTextarea
              label="Roof notes"
              rows={4}
              value={sheet.notes ?? ""}
              onChange={(e) => void patchData({ sheet: { ...sheet, notes: e.target.value } })}
            />
          </CbCard>

          <div aria-hidden className="cb-has-dock" />
          <div className="cb-dock">
            <div className="mx-auto flex w-full max-w-[620px] items-center gap-2">
              <CbButton
                block
                onClick={() => navigate({ to: "/cb/job/$id/scope", params: { id } })}
              >
                Finish the roof
              </CbButton>
            </div>
          </div>
        </div>

        {wideCam ? (
          <CbCamera
            open
            jobId={id}
            workspaceId={job?.workspace_id as string | undefined}
            title={`${CB_ELEVATION_LABEL[wideCam]} elevation — wide`}
            instruction={`Shoot the whole ${CB_ELEVATION_LABEL[wideCam].toUpperCase()} elevation.`}
            captionContext={`${CB_ELEVATION_LABEL[wideCam]} elevation — wide`}
            meta={{ category: "roof", elevation: wideCam, shot_type: "wide" }}
            onSaved={async (count) => {
              const prev = takeoff.elevations[wideCam]?.slopeWide ?? 0;
              await patchElevation(wideCam, { slopeWide: prev + count });
            }}
            onClose={() => setWideCam(null)}
          />
        ) : null}

        {closeCam ? (
          <CbCamera
            open
            jobId={id}
            workspaceId={job?.workspace_id as string | undefined}
            title={`${closeCam.label} — close-up`}
            instruction={`Get in tight on ${closeCam.label.toLowerCase()}.`}
            captionContext={`Roof — ${closeCam.label} — close-up`}
            meta={{
              category: "roof",
              shot_type: "detail",
              ...(closeCam.key ? { item_key: closeCam.key } : {}),
            }}
            onSaved={async () => {
              await qc.invalidateQueries({ queryKey: ["cb-roof-photos", id] });
            }}
            onClose={() => setCloseCam(null)}
          />
        ) : null}

        <CbPendingPill />
      </div>
    </CbSurface>
  );
}
