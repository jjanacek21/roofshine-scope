import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

/** Rasterize each `.est-page` section of the estimate document into a letter PDF. */
export async function generateEstimatePdf(rootEl: HTMLElement, filename: string) {
  const pages = Array.from(rootEl.querySelectorAll<HTMLElement>(".est-page"));
  if (pages.length === 0) throw new Error("Nothing to export");

  const pdf = new jsPDF("p", "pt", "letter");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  let first = true;
  for (const el of pages) {
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const ratio = canvas.height / canvas.width;
    const fullHeight = contentWidth * ratio;

    // Slice tall sections across multiple pages instead of squashing them.
    const sliceCount = Math.max(1, Math.ceil(fullHeight / contentHeight));
    for (let s = 0; s < sliceCount; s++) {
      if (!first) pdf.addPage();
      first = false;
      const offsetY = -(s * contentHeight);
      pdf.addImage(imgData, "JPEG", margin, margin + offsetY, contentWidth, fullHeight);
      // Mask any overflow above/below the printable area.
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, margin, "F");
      pdf.rect(0, pageHeight - margin, pageWidth, margin, "F");
    }
  }

  pdf.save(filename);
}
