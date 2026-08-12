import { useEffect, useMemo } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbChip, CbLoading } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import { useScrollMemory } from "@/components/cb/forms";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { useCbPhotoUrl } from "@/lib/cbPhotos";
import { useCbUploadQueue } from "@/lib/cbPhotoQueue";
import { CB_ELEVATIONS, CB_ELEVATION_LABEL, type CbElevation } from "@/lib/cbTakeoff";
import { overallCompleteness, readSheet, scoreSheet } from "@/lib/cbSheet";

export const Route = createFileRoute("/cb/job/$id/review")({
  head: () => ({
    meta: [
      { title: "Pre-flight review — Claim Buddy" },
      {
        name: "description",
        content:
          "One scrollable pre-flight: photo counts, measurement source, takeoff completion and every gap before the report is created.",
      },
      { property: "og:title", content: "Pre-flight review — Claim Buddy" },
      { property: "og:description", content: "Catch the gaps before you leave the driveway." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbReviewPage,
});

type Photo = {
  id: string;
  category: string | null;
  elevation: string | null;
  shot_type: string | null;
  thumb_path: string | null;
  storage_path: string | null;
};

function Thumb({ path }: { path: string | null }) {
  const url = useCbPhotoUrl(path);
  return (
    <span
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        borderRadius: 12,
        flexShrink: 0,
        overflow: "hidden",
        display: "block",
        border: "1px solid var(--cb-border)",
        background: "var(--cb-surface-2, rgba(0,0,0,0.04))",
      }}
    >
      {url ? (
        <img src={url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
    </span>
  );
}

function CbReviewPage() {
  const { id } = useParams({ from: "/cb/job/$id/review" });
  const navigate = useNavigate();
  useScrollMemory(`review_${id}`);
  const { pending } = useCbUploadQueue();

  const { data, isLoading } = useQuery({
    queryKey: ["cb-review", id],
    queryFn: async () => {
      const [{ data: job }, { data: photos }, { data: measurement }, { data: takeoff }] = await Promise.all([
        supabase.from("cb_jobs").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("cb_photos")
          .select("id, category, elevation, shot_type, thumb_path, storage_path")
          .eq("job_id", id)
          .order("created_at", { ascending: true }),
        supabase.from("cb_measurements").select("*").eq("job_id", id).maybeSingle(),
        supabase.from("cb_takeoffs").select("data, elevations, completeness").eq("job_id", id).maybeSingle(),
      ]);
      return {
        job,
        photos: (photos ?? []) as Photo[],
        measurement,
        takeoff,
      };
    },
  });

  const job = data?.job;
  const photos = data?.photos ?? [];
  const measurement = data?.measurement;
  const takeoffData = (data?.takeoff?.data ?? {}) as Record<string, unknown>;
  const elevations = (data?.takeoff?.elevations ?? {}) as Partial<
    Record<CbElevation, { wide?: number; done?: boolean }>
  >;

  const sheet = useMemo(() => readSheet(takeoffData), [takeoffData]);
  const squares = Number(measurement?.total_squares ?? 0);
  const scores = useMemo(() => scoreSheet(sheet, squares), [sheet, squares]);
  const completeness = overallCompleteness(scores);

  /* the pre-flight is the authoritative score */
  useEffect(() => {
    if (isLoading || !data?.takeoff) return;
    void supabase
      .from("cb_takeoffs")
      .update({ completeness })
      .eq("job_id", id)
      .then(() => undefined);
  }, [completeness, id, isLoading, data?.takeoff]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of photos) map[p.category ?? "other"] = (map[p.category ?? "other"] ?? 0) + 1;
    return map;
  }, [photos]);

  const byElevation = useMemo(() => {
    const map: Record<string, Photo[]> = {};
    for (const p of photos) {
      if (!p.elevation) continue;
      (map[p.elevation] ??= []).push(p);
    }
    return map;
  }, [photos]);

  /** Elevations the rep actually inspected. */
  const inspected = useMemo(
    () => CB_ELEVATIONS.filter((e) => elevations[e]?.done || (byElevation[e]?.length ?? 0) > 0),
    [elevations, byElevation],
  );

  const source = measurement?.rep_adjusted
    ? "Rep-adjusted"
    : measurement?.source === "manual"
      ? "Manual"
      : measurement
        ? "Instant"
        : null;

  /* ---------------- gaps ---------------- */
  type Gap = { text: string; to: string };
  const gaps = useMemo(() => {
    const out: Gap[] = [];
    if (!job) return out;
    if (!job.customer_phone) out.push({ text: "No customer phone number", to: "customer" });
    if (!job.carrier) out.push({ text: "Carrier missing", to: "customer" });
    if (!job.claim_number) out.push({ text: "Claim number missing", to: "customer" });
    if (!job.date_of_loss) out.push({ text: "Date of loss missing", to: "customer" });
    if (!job.cover_photo_path) out.push({ text: "No cover photo", to: "cover" });
    for (const e of inspected) {
      if (!elevations[e]?.wide) {
        out.push({ text: `${CB_ELEVATION_LABEL[e]} elevation has no wide shot`, to: "exterior" });
      }
    }
    if (squares <= 0) out.push({ text: "No squares recorded", to: "measure" });
    if (!sheet.roof_system.roof_type) out.push({ text: "Roof type not selected", to: "takeoff" });
    if (completeness < 60) out.push({ text: `Takeoff sheet only ${completeness}% complete`, to: "takeoff" });
    if (pending > 0) {
      out.push({ text: `${pending} photo${pending === 1 ? "" : "s"} still uploading`, to: "review" });
    }
    return out;
  }, [job, inspected, elevations, squares, sheet, completeness, pending]);

  const blockers: string[] = [];
  if (!job?.cover_photo_path) blockers.push("a cover photo");
  const missingWide = inspected.filter((e) => !elevations[e]?.wide);
  if (missingWide.length > 0) {
    blockers.push(`a wide shot on ${missingWide.map((e) => CB_ELEVATION_LABEL[e].toLowerCase()).join(", ")}`);
  }
  if (squares <= 0) blockers.push("squares recorded");

  function go(to: string) {
    if (to === "review") return;
    navigate({ to: `/cb/job/$id/${to}` as "/cb/job/$id/takeoff", params: { id } });
  }

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Running the pre-flight…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-32 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                Pre-flight review
              </h1>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Everything in one scroll before the report is written.
              </p>
            </div>
            <CbButton size="md" variant="ghost" onClick={() => navigate({ to: "/cb" })}>
              Save &amp; exit
            </CbButton>
          </div>

          {/* HEADER */}
          <CbReveal>
            <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
              <span className="cb-microlabel">Inspection</span>
              <p className="mt-1 text-[18px] font-semibold" style={{ color: "var(--cb-text)" }}>
                {job?.address ?? "No address"}
              </p>
              <p className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                {[job?.city, job?.state, job?.zip].filter(Boolean).join(", ")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[13.5px]">
                {[
                  ["Customer", job?.customer_name],
                  ["Carrier", job?.carrier],
                  ["Claim number", job?.claim_number],
                  ["Date of loss", job?.date_of_loss],
                  ["Inspection date", job?.inspection_date],
                  ["Phone", job?.customer_phone],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span className="cb-microlabel">{label}</span>
                    <p className="cb-num" style={{ color: value ? "var(--cb-text)" : "var(--cb-text-muted)" }}>
                      {value ? String(value) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </CbCard>
          </CbReveal>

          {/* PHOTOS */}
          <CbReveal>
            <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="cb-display" style={{ fontSize: 17, margin: 0 }}>
                  Photos
                </h2>
                <CbChip>{photos.length} total</CbChip>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(byCategory).map(([cat, n]) => (
                  <CbChip key={cat}>
                    {cat} · {n}
                  </CbChip>
                ))}
                {photos.length === 0 ? (
                  <p className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                    No photos captured yet.
                  </p>
                ) : null}
              </div>

              {CB_ELEVATIONS.filter((e) => (byElevation[e]?.length ?? 0) > 0).map((e) => (
                <div key={e} className="mt-4">
                  <div className="flex items-center justify-between">
                    <span className="cb-microlabel">{CB_ELEVATION_LABEL[e]} elevation</span>
                    <span className="cb-num text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                      {byElevation[e].length}
                    </span>
                  </div>
                  <div className="cb-photo-grid mt-2">
                    {byElevation[e].slice(0, 12).map((p) => (
                      <Thumb key={p.id} path={p.thumb_path ?? p.storage_path} />
                    ))}
                  </div>
                </div>
              ))}
            </CbCard>
          </CbReveal>

          {/* MEASUREMENT */}
          <CbReveal>
            <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="cb-display" style={{ fontSize: 17, margin: 0 }}>
                  Measurement
                </h2>
                {source ? (
                  <CbBadge tone={source === "Instant" ? "success" : source === "Rep-adjusted" ? "accent" : "neutral"}>
                    {source}
                  </CbBadge>
                ) : (
                  <CbBadge tone="warning">Missing</CbBadge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-[13.5px]">
                <div>
                  <span className="cb-microlabel">Squares</span>
                  <p className="cb-num">{squares ? squares.toFixed(1) : "—"}</p>
                </div>
                <div>
                  <span className="cb-microlabel">Pitch</span>
                  <p className="cb-num">{measurement?.pitch ?? "—"}</p>
                </div>
                <div>
                  <span className="cb-microlabel">Facets</span>
                  <p className="cb-num">{measurement?.facets ?? "—"}</p>
                </div>
              </div>
              <CbButton
                size="md"
                variant="ghost"
                className="mt-3"
                onClick={() => navigate({ to: "/cb/job/$id/measure", params: { id } })}
              >
                Open measurement
              </CbButton>
            </CbCard>
          </CbReveal>

          {/* TAKEOFF */}
          <CbReveal>
            <CbCard elevation="raised" className="mt-4" style={{ padding: 20 }}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="cb-display" style={{ fontSize: 17, margin: 0 }}>
                  Takeoff
                </h2>
                <CbChip>{completeness}% complete</CbChip>
              </div>
              <div className="mt-3 grid gap-2">
                {scores.map((s) => (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="flex-1 text-[14px]" style={{ color: "var(--cb-text)" }}>
                      {s.label}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 90,
                        height: 6,
                        borderRadius: 99,
                        background: "var(--cb-border)",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${s.pct}%`,
                          background: "var(--cb-accent)",
                        }}
                      />
                    </span>
                    <span className="cb-num text-[12px]" style={{ color: "var(--cb-text-muted)", width: 34 }}>
                      {s.pct}%
                    </span>
                  </div>
                ))}
              </div>
              <CbButton
                size="md"
                variant="ghost"
                className="mt-3"
                onClick={() => navigate({ to: "/cb/job/$id/takeoff", params: { id } })}
              >
                Open takeoff sheet
              </CbButton>
            </CbCard>
          </CbReveal>

          {/* GAPS */}
          {gaps.length > 0 ? (
            <CbReveal>
              <CbCard
                elevation="raised"
                className="mt-4"
                style={{
                  padding: 20,
                  border: "1px solid var(--cb-warning, #b45309)",
                  background: "rgba(180,83,9,0.07)",
                }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} style={{ color: "var(--cb-warning, #b45309)" }} />
                  <h2 className="cb-display" style={{ fontSize: 17, margin: 0 }}>
                    {gaps.length} gap{gaps.length === 1 ? "" : "s"}
                  </h2>
                </div>
                <div className="mt-3 grid gap-2">
                  {gaps.map((g) => (
                    <button
                      key={g.text}
                      type="button"
                      onClick={() => go(g.to)}
                      className="flex items-center justify-between gap-3 rounded-[12px] px-3 text-left"
                      style={{
                        minHeight: 48,
                        border: "1px solid var(--cb-border)",
                        background: "var(--cb-surface, transparent)",
                      }}
                    >
                      <span className="text-[14px]" style={{ color: "var(--cb-text)" }}>
                        {g.text}
                      </span>
                      <ChevronRight size={16} style={{ color: "var(--cb-text-muted)" }} />
                    </button>
                  ))}
                </div>
              </CbCard>
            </CbReveal>
          ) : null}

          {/* CREATE REPORT */}
          <div aria-hidden className="cb-has-dock" />
          <div className="cb-dock">
            <CbButton
              block
              disabled={blockers.length > 0}
              onClick={() => navigate({ to: "/cb/job/$id/generating", params: { id } })}
            >
              Create Report
            </CbButton>
            {blockers.length > 0 ? (
              <p className="text-center text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                Still needed: {blockers.join(", ")}.
              </p>
            ) : null}
          </div>
        </div>
        <CbPendingPill />
      </div>
    </CbSurface>
  );
}
