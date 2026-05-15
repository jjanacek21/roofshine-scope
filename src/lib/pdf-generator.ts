import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { supabase } from "@/integrations/supabase/client";

export async function generateProposalPdf({
  rootEl,
  jobId,
  estimateId,
  companyId,
  hidePricing,
}: {
  rootEl: HTMLElement;
  jobId: string;
  estimateId: string | null;
  companyId: string;
  hidePricing: boolean;
}): Promise<{ pdfPath: string; signedUrl: string | null }> {
  const sections = Array.from(rootEl.querySelectorAll<HTMLElement>(".pdf-section"));
  if (sections.length === 0) throw new Error("No sections to render");

  const pdf = new jsPDF("p", "pt", "letter");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < sections.length; i++) {
    if (i > 0) pdf.addPage();
    const canvas = await html2canvas(sections[i], {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const ratio = canvas.height / canvas.width;
    let imgWidth = pageWidth;
    let imgHeight = imgWidth * ratio;
    if (imgHeight > pageHeight) {
      imgHeight = pageHeight;
      imgWidth = imgHeight / ratio;
    }
    const x = (pageWidth - imgWidth) / 2;
    pdf.addImage(imgData, "JPEG", x, 0, imgWidth, imgHeight);
  }

  const blob = pdf.output("blob");
  const filename = `proposal-${Date.now()}.pdf`;
  const path = `${companyId}/${jobId}/${filename}`;

  const { error: upErr } = await supabase.storage
    .from("generated-pdfs")
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  await supabase.from("generated_reports").insert({
    job_id: jobId,
    estimate_id: estimateId,
    company_id: companyId,
    pdf_path: path,
    hide_pricing: hidePricing,
  });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const { data: signed } = await supabase.storage
    .from("generated-pdfs")
    .createSignedUrl(path, 3600);

  return { pdfPath: path, signedUrl: signed?.signedUrl ?? null };
}
