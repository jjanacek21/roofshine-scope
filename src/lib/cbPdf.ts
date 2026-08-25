/**
 * Claim Buddy report PDF.
 *
 * The PDF is a direct capture of the on-screen template document, so the
 * printed report and the screen can never drift. Each `.cbr-page` node is
 * rasterised and placed on one Letter page at full bleed.
 */
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { supabase } from "@/integrations/supabase/client";
import { CB_TEMPLATE_PAGE_CLASS } from "@/components/cb/CbReportTemplate";

export const CB_DOC_BUCKET = "cb-documents";

export interface CbPdfProgress {
  (step: string): void;
}

/** Rasterise every template page in `root` into a Letter PDF blob. */
export async function renderReportPdf(root: HTMLElement, onStep?: CbPdfProgress): Promise<Blob> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>(`.${CB_TEMPLATE_PAGE_CLASS}`));
  if (pages.length === 0) throw new Error("The report document is not on screen yet.");

  const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    onStep?.(`Rendering page ${i + 1} of ${pages.length}…`);
    const canvas = await html2canvas(pages[i], {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: 816,
    });
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pw, ph, undefined, "FAST");
  }

  return pdf.output("blob");
}

/** Render, upload to cb-documents and stamp cb_reports.pdf_path. */
export async function renderAndStoreReportPdf(args: {
  element: HTMLElement;
  reportId: string;
  workspaceId: string;
  jobId: string;
  version: number;
  onStep?: CbPdfProgress;
}): Promise<string> {
  const { element, reportId, workspaceId, jobId, version, onStep } = args;
  const blob = await renderReportPdf(element, onStep);
  const path = `${workspaceId}/${jobId}/report-v${version}.pdf`;
  onStep?.("Storing the document…");
  const { error } = await supabase.storage
    .from(CB_DOC_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  await supabase.from("cb_reports").update({ pdf_path: path }).eq("id", reportId);
  return path;
}

export async function cbDocumentSignedUrl(path: string | null | undefined, expiresIn = 3600) {
  if (!path) return null;
  const { data } = await supabase.storage.from(CB_DOC_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
