import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFNumber, PDFRef } from "pdf-lib";
import html2canvas from "html2canvas-pro";
import { supabase } from "@/integrations/supabase/client";

export type VideoEmbed = {
  /** rectangle on the page where the player should appear */
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  posterBytes: Uint8Array;
  posterMime: string;
  videoBytes: Uint8Array;
  videoMime: string;
  fallbackUrl?: string;
};

/**
 * Render a list of section DOM elements into a PDF (letter, portrait).
 * Returns the assembled bytes plus the pdf-lib document so callers can
 * append video annotations or merge external PDFs.
 */
export async function renderSectionsToPdf(
  sections: HTMLElement[],
): Promise<{ doc: PDFDocument; pageMap: Array<{ pageIndex: number; sectionEl: HTMLElement; canvasW: number; canvasH: number; drawW: number; drawH: number; x: number; y: number }> }> {
  const doc = await PDFDocument.create();
  // Ensure web fonts (Archivo, JetBrains Mono) are loaded before html2canvas
  // captures the DOM — otherwise canvas falls back to serif defaults.
  if (typeof document !== "undefined" && (document as any).fonts?.ready) {
    try { await (document as any).fonts.ready; } catch {}
  }
  const pageWidth = 612; // letter pt
  const pageHeight = 792;
  const margin = 24;
  const gap = 12; // gap between stacked sections
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const pageMap: Array<{ pageIndex: number; sectionEl: HTMLElement; canvasW: number; canvasH: number; drawW: number; drawH: number; x: number; y: number }> = [];

  let currentPage = doc.addPage([pageWidth, pageHeight]);
  let cursorY = margin; // distance from top of page already consumed

  for (const el of sections) {
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      onclone: (_clonedDoc, clonedRoot) => {
        prepareCloneForRender(el, clonedRoot as HTMLElement);
      },
    });

    const ratio = canvas.height / canvas.width;
    let drawW = contentWidth;
    let drawH = drawW * ratio;
    // If the section taller than a full page, scale it down to fit one page
    if (drawH > contentHeight) {
      drawH = contentHeight;
      drawW = drawH / ratio;
    }

    const remaining = pageHeight - margin - cursorY;
    const needsGap = cursorY > margin;
    const required = drawH + (needsGap ? gap : 0);
    if (required > remaining) {
      // Start a new page
      currentPage = doc.addPage([pageWidth, pageHeight]);
      cursorY = margin;
    } else if (needsGap) {
      cursorY += gap;
    }

    const imgBytes = await new Promise<Uint8Array>((res) =>
      canvas.toBlob(
        (b) => b!.arrayBuffer().then((ab) => res(new Uint8Array(ab))),
        "image/jpeg",
        0.9,
      ),
    );
    const img = await doc.embedJpg(imgBytes);
    const x = (pageWidth - drawW) / 2;
    const y = pageHeight - cursorY - drawH; // pdf-lib origin is bottom-left
    currentPage.drawImage(img, { x, y, width: drawW, height: drawH });
    pageMap.push({
      pageIndex: doc.getPageCount() - 1,
      sectionEl: el,
      canvasW: canvas.width,
      canvasH: canvas.height,
      drawW,
      drawH,
      x,
      y,
    });
    cursorY += drawH;
  }

  return { doc, pageMap };
}


/**
 * Append a RichMedia annotation that plays a video inline (Acrobat &
 * compatible mobile readers). Adds a clickable URI fallback for viewers
 * that ignore RichMedia.
 */
export async function addVideoAnnotation(doc: PDFDocument, v: VideoEmbed) {
  const page = doc.getPage(v.pageIndex);
  const ph = page.getHeight();
  const rect = [v.x, ph - v.y - v.height, v.x + v.width, ph - v.y];

  // Embed video stream
  const videoStream = doc.context.flateStream(v.videoBytes, {
    Type: PDFName.of("EmbeddedFile"),
    Subtype: PDFName.of(v.videoMime),
  });
  const videoStreamRef = doc.context.register(videoStream);

  const fileSpec = doc.context.obj({
    Type: "Filespec",
    F: PDFString.of("video.mp4"),
    UF: PDFString.of("video.mp4"),
    EF: doc.context.obj({ F: videoStreamRef }),
  });
  const fileSpecRef = doc.context.register(fileSpec);

  // Build RichMedia annotation
  const annot = doc.context.obj({
    Type: "Annot",
    Subtype: "RichMedia",
    Rect: rect,
    P: page.ref,
    Border: [0, 0, 0],
    RichMediaContent: {
      Assets: { Names: [PDFString.of("video.mp4"), fileSpecRef] },
      Configurations: [
        {
          Subtype: "Video",
          Instances: [
            {
              Subtype: "Video",
              Asset: fileSpecRef,
              Params: { FlashVars: PDFString.of("") },
            },
          ],
        },
      ],
    },
    RichMediaSettings: {
      Activation: { Condition: "XA" },
      Deactivation: { Condition: "XD" },
    },
  });
  const annotRef = doc.context.register(annot);

  // Attach as page annotation
  const existing = page.node.Annots();
  if (existing instanceof PDFArray) {
    existing.push(annotRef);
  } else {
    page.node.set(PDFName.of("Annots"), doc.context.obj([annotRef]));
  }

  // Fallback URL link covering the same rect — opens video in browser when RichMedia unsupported
  if (v.fallbackUrl) {
    page.doc.context;
    const linkAnnot = doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: rect,
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(v.fallbackUrl) },
    });
    const linkRef = doc.context.register(linkAnnot);
    const annots2 = page.node.Annots();
    if (annots2 instanceof PDFArray) annots2.push(linkRef);
  }
}

export async function uploadAndRegisterPdf({
  bytes,
  jobId,
  companyId,
  estimateId,
  hidePricing,
}: {
  bytes: Uint8Array;
  jobId: string;
  companyId: string;
  estimateId: string | null;
  hidePricing: boolean;
}) {
  const filename = `report-${Date.now()}.pdf`;
  const path = `${companyId}/${jobId}/${filename}`;
  // Trigger download
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
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
    const { error } = await supabase.storage
      .from("generated-pdfs")
      .upload(path, blob, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    const { data: report } = await supabase
      .from("generated_reports")
      .insert({
        job_id: jobId,
        estimate_id: estimateId,
        company_id: companyId,
        pdf_path: path,
        hide_pricing: hidePricing,
      })
      .select("id")
      .single();
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
    const { data: signed } = await supabase.storage
      .from("generated-pdfs")
      .createSignedUrl(path, 3600);
    signedUrl = signed?.signedUrl ?? null;
  } catch (e) {
    console.warn("PDF generated locally but upload failed", e);
  }
  return { signedUrl, path };
}
