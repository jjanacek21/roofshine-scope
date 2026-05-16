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
  const margin = 24;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const sectionGap = 12;

  let cursorY = margin;

  for (let i = 0; i < sections.length; i++) {
    const canvas = await html2canvas(sections[i], {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const ratio = canvas.height / canvas.width;
    let imgWidth = contentWidth;
    let imgHeight = imgWidth * ratio;

    // If section is taller than a full page, scale it down to fit one page.
    if (imgHeight > contentHeight) {
      imgHeight = contentHeight;
      imgWidth = imgHeight / ratio;
    }

    const remaining = pageHeight - margin - cursorY;
    if (imgHeight > remaining && cursorY > margin) {
      pdf.addPage();
      cursorY = margin;
    }

    const x = (pageWidth - imgWidth) / 2;
    pdf.addImage(imgData, "JPEG", x, cursorY, imgWidth, imgHeight);
    cursorY += imgHeight + sectionGap;
  }

  const blob = pdf.output("blob");
  const filename = `proposal-${Date.now()}.pdf`;
  const path = `${companyId}/${jobId}/${filename}`;

  // Trigger download immediately so the user always gets the file,
  // even if the storage upload below fails.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  let signedUrl: string | null = null;
  try {
    const { error: upErr } = await supabase.storage
      .from("generated-pdfs")
      .upload(path, blob, { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;

    const { data: report } = await supabase.from("generated_reports").insert({
      job_id: jobId,
      estimate_id: estimateId,
      company_id: companyId,
      pdf_path: path,
      hide_pricing: hidePricing,
    }).select("id").single();

    // Mirror into job_documents so it appears in the Documents tab.
    try {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("job_documents").insert({
        job_id: jobId,
        company_id: companyId,
        kind: "completed_report",
        title: filename,
        bucket: "generated-pdfs",
        storage_path: path,
        mime_type: "application/pdf",
        file_size: blob.size,
        source_table: "generated_reports",
        source_id: report?.id ?? null,
        created_by: u.user?.id ?? null,
      });
    } catch (e) {
      console.warn("Report uploaded but failed to mirror into job_documents:", e);
    }

    const { data: signed } = await supabase.storage
      .from("generated-pdfs")
      .createSignedUrl(path, 3600);
    signedUrl = signed?.signedUrl ?? null;
  } catch (err) {
    console.warn("PDF generated locally, but upload failed:", err);
  }

  return { pdfPath: path, signedUrl };
}
