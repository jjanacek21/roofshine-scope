import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeVentilation, readSheet } from "@/lib/cbSheet";
import { cbLogoSignedUrl } from "@/lib/cbLogo";
import { CB_PHOTO_BUCKET } from "@/lib/cbPhotos";
import { loadReportInputs, type CbLineItem, type CbNarrative, type CbReportPhoto, CB_STATEMENT } from "@/lib/cbReport";
import type { CbElevation, CbElevationState, CbRoom } from "@/lib/cbTakeoff";
import type { CbReportViewModel } from "@/components/cb/CbReportDoc";

/** Batch-sign every photo path the report renders. */
export async function signPhotoUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 100) {
    const slice = unique.slice(i, i + 100);
    const { data } = await supabase.storage.from(CB_PHOTO_BUCKET).createSignedUrls(slice, expiresIn);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
    }
  }
  return out;
}

export interface CbReportRow {
  id: string;
  job_id: string;
  version: number;
  narrative: CbNarrative;
  line_items: CbLineItem[];
  ventilation: ReturnType<typeof computeVentilation>;
  pdf_path: string | null;
  share_token: string | null;
  share_expires_at: string | null;
  generated_at: string;
}

/** Load a stored report and everything it renders. */
export function useCbReport(jobId: string, reportId?: string) {
  return useQuery({
    queryKey: ["cb-report", jobId, reportId ?? "latest"],
    queryFn: async () => {
      let q = supabase.from("cb_reports").select("*").eq("job_id", jobId);
      q = reportId ? q.eq("id", reportId) : q.order("version", { ascending: false }).limit(1);
      const { data: report } = await q.maybeSingle();
      if (!report) return null;

      const inputs = await loadReportInputs(jobId);
      const paths = inputs.photos.flatMap((p) => [p.storage_path, p.thumb_path].filter(Boolean) as string[]);
      const [urls, logoUrl, { data: auth }] = await Promise.all([
        signPhotoUrls(paths),
        cbLogoSignedUrl((inputs.company?.logo_url as string) ?? null),
        supabase.auth.getUser(),
      ]);

      const vm = assembleVm({
        report: report as unknown as CbReportRow,
        inputs,
        urls,
        logoUrl,
        repName:
          (auth.user?.user_metadata?.full_name as string) ??
          (auth.user?.email as string) ??
          null,
      });
      return { report: report as unknown as CbReportRow, vm, inputs };
    },
  });
}

export function assembleVm(args: {
  report: CbReportRow;
  inputs: Awaited<ReturnType<typeof loadReportInputs>>;
  urls: Record<string, string>;
  logoUrl: string | null;
  repName: string | null;
}): CbReportViewModel {
  const { report, inputs, urls, logoUrl, repName } = args;
  const takeoffData = (inputs.takeoff?.data ?? {}) as Record<string, unknown>;
  const sheet = readSheet(takeoffData);
  const rooms = ((takeoffData.rooms as CbRoom[]) ?? []).filter(Boolean);
  const elevations = (inputs.takeoff?.elevations ?? {}) as Partial<Record<CbElevation, CbElevationState>>;
  const measurement = inputs.measurement;
  const squares = Number(measurement?.total_squares ?? 0) || 0;
  const vent =
    report.ventilation && typeof report.ventilation === "object" && "requiredNfa" in report.ventilation
      ? report.ventilation
      : computeVentilation(sheet.ventilation, squares, sheet.roof_system.pitch ?? String(measurement?.pitch ?? "6/12"));

  const coverPath = (inputs.job?.cover_photo_path as string) ?? null;
  const coverPhoto =
    inputs.photos.find((p) => p.storage_path === coverPath) ??
    inputs.photos.find((p) => p.category === "cover") ??
    null;

  const source = measurement?.rep_adjusted
    ? "Rep-adjusted"
    : measurement?.source === "manual"
      ? "Manual"
      : measurement
        ? "Instant"
        : null;

  return {
    company: (inputs.company ?? null) as CbReportViewModel["company"],
    logoUrl,
    job: (inputs.job ?? null) as CbReportViewModel["job"],
    repName,
    coverPhoto: coverPhoto as CbReportPhoto | null,
    photos: inputs.photos,
    urls,
    sheet,
    rooms,
    elevations,
    measurement,
    measurementSource: source,
    vent,
    narrative: {
      summary: report.narrative?.summary ?? "",
      statement: report.narrative?.statement ?? CB_STATEMENT,
      profile_note: report.narrative?.profile_note,
      roof_note: report.narrative?.roof_note,
      exterior_note: report.narrative?.exterior_note,
      interior_note: report.narrative?.interior_note,
      scope_note: report.narrative?.scope_note,
    },
    lineItems: (report.line_items ?? []) as CbLineItem[],
    version: report.version,
    generatedAt: report.generated_at,
  };
}
