import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import { supabase } from "@/integrations/supabase/client";
import { fileJobDocument, type JobDocumentKind } from "@/lib/jobDocuments";

/**
 * Turning an order-form document into a real PDF.
 *
 * The three order-form documents — Pre-Cap, Crew Work Order, Supplier Order —
 * only ever existed as `window.print()`. That meant nothing was ever produced
 * that could be saved, so none of them could reach the job's Documents tab, and
 * a crew lead who wanted yesterday's work order had to rebuild it.
 *
 * These render as ordinary HTML rather than as a form we fill, so the PDF is
 * made by rasterizing the printed card and slicing it across letter pages —
 * the same approach the proposal generator already uses. It is a picture of the
 * document rather than selectable text, which is the right trade here: these go
 * to a crew or a supplier counter to be read and signed, not searched.
 */

export type OrderFormDoc = "precap" | "crew" | "supplier";

const DOCS: Record<OrderFormDoc, { title: string; slug: string; kind: JobDocumentKind }> = {
  // Pre-cap carries cost, markup and margin. It is filed so it can be found
  // later, but never as a "work order" — it is not a document to hand out.
  precap: { title: "Pre-Cap (internal — do not share)", slug: "pre-cap", kind: "other" },
  crew: { title: "Crew Work Order", slug: "crew-work-order", kind: "work_order" },
  supplier: { title: "Supplier Order", slug: "supplier-order", kind: "work_order" },
};

export function orderFormDocTitle(doc: OrderFormDoc): string {
  return DOCS[doc].title;
}

/** Hand the file to the user immediately, before anything that can fail. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Rasterize `el` and lay it out across letter pages.
 *
 * The card is captured once at full height and then sliced, rather than
 * captured per section, so a long materials table keeps its column widths and
 * its header alignment across the page break.
 */
async function renderToPdf(el: HTMLElement): Promise<Blob> {
  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    // The on-screen card is a rounded, shadowed panel. Those read as grey
    // smudges down the edge of a printed page, so drop them in the clone.
    onclone: (doc: Document) => {
      doc.querySelectorAll<HTMLElement>(".order-doc-card").forEach((n) => {
        n.style.boxShadow = "none";
        n.style.borderRadius = "0";
      });
    },
  });

  const pdf = new jsPDF("p", "pt", "letter");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // One canvas pixel is this many points once the capture is drawn at content
  // width. Everything below converts through it.
  const ptPerPx = contentWidth / canvas.width;
  const sliceHeightPx = Math.floor(contentHeight / ptPerPx);

  const slice = document.createElement("canvas");
  const ctx = slice.getContext("2d");
  if (!ctx) throw new Error("This browser would not give us a canvas to draw the PDF on.");

  let offset = 0;
  let page = 0;
  while (offset < canvas.height) {
    const h = Math.min(sliceHeightPx, canvas.height - offset);
    slice.width = canvas.width;
    slice.height = h;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, h, 0, 0, canvas.width, h);

    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, contentWidth, h * ptPerPx);

    offset += h;
    page += 1;
  }

  return pdf.output("blob");
}

export interface SaveOrderFormPdfInput {
  /** The printed card itself — not the scroll container around it. */
  el: HTMLElement;
  doc: OrderFormDoc;
  jobId: string;
  companyId: string;
  /** Job number or name, so the downloaded file is recognisable on a desktop. */
  jobLabel?: string | null;
  /** The snapshot or draft this was built from, so the row can be traced back. */
  sourceTable?: string | null;
  sourceId?: string | null;
}

export interface SaveOrderFormPdfResult {
  filename: string;
  storagePath: string | null;
  /** True when the file is now listed on the job's Documents tab. */
  filed: boolean;
}

/**
 * Generate the PDF, hand it to the user, then file it on the job.
 *
 * The download happens first and unconditionally. Storage and filing are a
 * convenience on top: if either fails the user still has the document, and the
 * caller is told what actually happened rather than being shown a success
 * toast for a file that never landed.
 */
export async function saveOrderFormPdf(input: SaveOrderFormPdfInput): Promise<SaveOrderFormPdfResult> {
  const meta = DOCS[input.doc];
  const stamp = new Date().toISOString().slice(0, 10);
  const jobPart = (input.jobLabel ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const filename = [meta.slug, jobPart, stamp].filter(Boolean).join("-") + ".pdf";

  const blob = await renderToPdf(input.el);
  downloadBlob(blob, filename);

  const storagePath = `${input.companyId}/${input.jobId}/work-orders/${Date.now()}-${filename}`;
  const { error: upErr } = await supabase.storage
    .from("job-documents")
    .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });

  if (upErr) {
    console.warn("order form PDF was generated but could not be stored", upErr);
    return { filename, storagePath: null, filed: false };
  }

  const filed = await fileJobDocument({
    jobId: input.jobId,
    companyId: input.companyId,
    kind: meta.kind,
    title: meta.title,
    bucket: "job-documents",
    storagePath,
    mimeType: "application/pdf",
    fileSize: blob.size,
    sourceTable: input.sourceTable ?? null,
    sourceId: input.sourceId ?? null,
  });

  return { filename, storagePath, filed };
}
