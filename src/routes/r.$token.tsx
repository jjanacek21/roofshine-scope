import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbLoading } from "@/components/cb/primitives";
import { CbReportDoc, type CbReportViewModel } from "@/components/cb/CbReportDoc";
import { computeVentilation, readSheet } from "@/lib/cbSheet";
import { CB_STATEMENT, type CbLineItem, type CbNarrative, type CbReportPhoto } from "@/lib/cbReport";
import type { CbElevation, CbElevationState, CbRoom } from "@/lib/cbTakeoff";

/** Public, no-login view of a shared report. Expires with the token. */
export const Route = createFileRoute("/r/$token")({
  head: () => ({
    meta: [
      { title: "Property damage inspection report" },
      {
        name: "description",
        content: "A shared property damage inspection report: findings, measurements, recommended scope and photo appendix.",
      },
      { property: "og:title", content: "Property damage inspection report" },
      { property: "og:description", content: "Shared inspection report — findings, scope and photos." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CbSharedReportPage,
});

function assetUrl(token: string, path: string | null | undefined, bucket: "photos" | "documents" = "photos") {
  if (!path) return "";
  return `/api/public/cb-share?token=${encodeURIComponent(token)}&bucket=${bucket}&path=${encodeURIComponent(path)}`;
}

function CbSharedReportPage() {
  const { token } = useParams({ from: "/r/$token" });

  const { data, isLoading } = useQuery({
    queryKey: ["cb-shared-report", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cb_report_by_token", { _token: token });
      if (error) throw error;
      return data as unknown as {
        report: {
          version: number;
          generated_at: string;
          narrative: CbNarrative;
          line_items: CbLineItem[];
          ventilation: ReturnType<typeof computeVentilation>;
          pdf_path: string | null;
        };
        job: Record<string, string | number | null>;
        company: Record<string, unknown>;
        measurements: Record<string, number | string | null> | null;
        takeoff: { data: Record<string, unknown>; elevations: Record<string, unknown> } | null;
        photos: CbReportPhoto[];
      } | null;
    },
  });

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[760px]">
            <CbLoading label="Opening the report…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  if (!data) {
    return (
      <CbSurface>
        <div className="flex min-h-screen items-center px-5" style={{ background: "var(--cb-bg)" }}>
          <CbCard elevation="raised" className="mx-auto" style={{ padding: 26, maxWidth: 460 }}>
            <h1 className="cb-display" style={{ fontSize: 20, margin: 0 }}>
              This link has expired
            </h1>
            <p className="mt-2 text-[14.5px]" style={{ color: "var(--cb-text-muted)" }}>
              Shared reports stay live for 30 days. Ask your contractor for a fresh link.
            </p>
          </CbCard>
        </div>
      </CbSurface>
    );
  }

  const takeoffData = (data.takeoff?.data ?? {}) as Record<string, unknown>;
  const sheet = readSheet(takeoffData);
  const measurement = data.measurements;
  const squares = Number(measurement?.total_squares ?? 0) || 0;
  const vent =
    data.report.ventilation && "requiredNfa" in (data.report.ventilation ?? {})
      ? data.report.ventilation
      : computeVentilation(sheet.ventilation, squares, sheet.roof_system.pitch ?? "6/12");

  const urls: Record<string, string> = {};
  for (const p of data.photos ?? []) {
    urls[p.storage_path] = assetUrl(token, p.storage_path);
    if (p.thumb_path) urls[p.thumb_path] = assetUrl(token, p.thumb_path);
  }

  const coverPath = (data.job?.cover_photo_path as string) ?? null;
  const vm: CbReportViewModel = {
    company: data.company as CbReportViewModel["company"],
    logoUrl: null,
    job: data.job,
    repName: null,
    coverPhoto:
      (data.photos ?? []).find((p) => p.storage_path === coverPath) ??
      (data.photos ?? []).find((p) => p.category === "cover") ??
      null,
    photos: data.photos ?? [],
    urls,
    sheet,
    rooms: ((takeoffData.rooms as CbRoom[]) ?? []).filter(Boolean),
    elevations: (data.takeoff?.elevations ?? {}) as Partial<Record<CbElevation, CbElevationState>>,
    measurement,
    measurementSource: measurement?.rep_adjusted ? "Rep-adjusted" : measurement?.source === "manual" ? "Manual" : measurement ? "Instant" : null,
    vent,
    narrative: {
      summary: data.report.narrative?.summary ?? "",
      statement: data.report.narrative?.statement ?? CB_STATEMENT,
      profile_note: data.report.narrative?.profile_note,
      roof_note: data.report.narrative?.roof_note,
      exterior_note: data.report.narrative?.exterior_note,
      interior_note: data.report.narrative?.interior_note,
      scope_note: data.report.narrative?.scope_note,
    },
    lineItems: data.report.line_items ?? [],
    version: data.report.version,
    generatedAt: data.report.generated_at,
  };

  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-20 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[860px]">
          {data.report.pdf_path ? (
            <div className="mb-3 flex justify-end">
              <a href={assetUrl(token, data.report.pdf_path, "documents")} target="_blank" rel="noopener noreferrer">
                <CbButton size="md" variant="secondary">
                  Download PDF
                </CbButton>
              </a>
            </div>
          ) : null}
          <CbReportDoc vm={vm} />
        </div>
      </div>
    </CbSurface>
  );
}
