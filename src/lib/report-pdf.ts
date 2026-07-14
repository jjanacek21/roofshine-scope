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
 * Inline computed styles from the live DOM onto the clone html2canvas will
 * rasterize. Tailwind v4 utility classes (flex, grid, text-*, font-sans, etc.)
 * don't always survive the html2canvas clone, which is why the PDF looked
 * collapsed and serif. Locking in computed styles + replacing textareas with
 * plain divs (so their value/placeholder actually renders) fixes both.
 */
function prepareCloneForRender(originalRoot: HTMLElement, clonedRoot: HTMLElement) {
  const COPY_PROPS = [
    "display", "position", "boxSizing",
    "flexDirection", "flexWrap", "justifyContent", "alignItems", "alignSelf", "flex", "flexGrow", "flexShrink", "flexBasis", "gap", "rowGap", "columnGap",
    "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow",
    "width", "minWidth", "maxWidth",
    "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    "border", "borderTop", "borderRight", "borderBottom", "borderLeft",
    "borderColor", "borderStyle", "borderWidth", "borderRadius",
    "background", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat",
    "color", "opacity",
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textTransform", "textAlign", "textDecoration", "whiteSpace", "wordBreak", "overflowWrap",
    "objectFit", "objectPosition",
    "boxShadow",
  ];

  // Replace textareas FIRST (before walking) so the walk sees the new divs
  // and doesn't bake textarea computed heights into the clone.
  const origTextareas = Array.from(originalRoot.querySelectorAll("textarea"));
  const cloneTextareas = Array.from(clonedRoot.querySelectorAll("textarea"));
  origTextareas.forEach((ta, i) => {
    const cloneTa = cloneTextareas[i] as HTMLTextAreaElement | undefined;
    if (!cloneTa || !cloneTa.parentNode) return;
    const cs = window.getComputedStyle(ta);
    const text = (ta as HTMLTextAreaElement).value || (ta as HTMLTextAreaElement).placeholder || "";
    const div = clonedRoot.ownerDocument.createElement("div");
    div.textContent = text;
    div.style.whiteSpace = "pre-wrap";
    div.style.fontFamily = cs.fontFamily;
    div.style.fontSize = cs.fontSize;
    div.style.fontWeight = cs.fontWeight;
    div.style.lineHeight = cs.lineHeight;
    div.style.color = cs.color;
    div.style.width = "100%";
    cloneTa.parentNode.replaceChild(div, cloneTa);
  });

  const walk = (orig: Element, clone: Element) => {
    if (clone.tagName === "TEXTAREA" || orig.tagName === "TEXTAREA") return;
    const cs = window.getComputedStyle(orig);
    const target = clone as HTMLElement;
    for (const p of COPY_PROPS) {
      const kebab = p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
      const v = cs.getPropertyValue(kebab);
      if (v) target.style.setProperty(kebab, v);
    }
    const oc = Array.from(orig.children).filter((c) => c.tagName !== "TEXTAREA");
    const cc = Array.from(clone.children).filter((c) => c.tagName !== "TEXTAREA");
    for (let i = 0; i < oc.length && i < cc.length; i++) walk(oc[i], cc[i]);
  };
  walk(originalRoot, clonedRoot);

  clonedRoot.style.fontFamily =
    clonedRoot.style.fontFamily ||
    '"Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  // The on-screen preview uses cards/shadows and editable textareas. Those can
  // make html2canvas preserve a tall empty control/card area even when the
  // visible content is short, which pushes the next section to a new PDF page.
  // Flatten the export clone so each captured section is only as tall as its
  // actual report content.
  clonedRoot.style.height = "auto";
  clonedRoot.style.minHeight = "0";
  clonedRoot.style.boxShadow = "none";
  clonedRoot.style.borderRadius = "0";
}

function trimBottomWhitespace(canvas: HTMLCanvasElement, keepPx = 48) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let lastContentY = -1;

  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Treat near-white pixels as page background. Anything darker is report
      // content (text, rules, table lines, images, etc.).
      if (r < 248 || g < 248 || b < 248) {
        lastContentY = y;
        break;
      }
    }
    if (lastContentY !== -1) break;
  }

  if (lastContentY === -1) return canvas;
  const croppedHeight = Math.min(height, Math.max(1, lastContentY + keepPx));
  if (croppedHeight >= height - 4) return canvas;

  const trimmed = document.createElement("canvas");
  trimmed.width = width;
  trimmed.height = croppedHeight;
  const trimmedCtx = trimmed.getContext("2d")!;
  trimmedCtx.fillStyle = "#ffffff";
  trimmedCtx.fillRect(0, 0, trimmed.width, trimmed.height);
  trimmedCtx.drawImage(canvas, 0, 0);
  return trimmed;
}

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
    const rawCanvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      onclone: (_clonedDoc, clonedRoot) => {
        prepareCloneForRender(el, clonedRoot as HTMLElement);
      },
    });
    const canvas = trimBottomWhitespace(rawCanvas);

    const ratio = canvas.height / canvas.width;
    const drawW = contentWidth;
    const totalDrawH = drawW * ratio;

    // If the section fits on a single page, pack it onto current page (start
    // new page if not enough room). If it's taller than a page, slice it
    // across multiple pages so we never leave huge whitespace.
    if (totalDrawH <= contentHeight) {
      const remaining = pageHeight - margin - cursorY;
      const needsGap = cursorY > margin;
      const required = totalDrawH + (needsGap ? gap : 0);
      if (required > remaining) {
        currentPage = doc.addPage([pageWidth, pageHeight]);
        cursorY = margin;
      } else if (needsGap) {
        cursorY += gap;
      }
      const imgBytes = await canvasToJpegBytes(canvas);
      const img = await doc.embedJpg(imgBytes);
      const x = (pageWidth - drawW) / 2;
      const y = pageHeight - cursorY - totalDrawH;
      currentPage.drawImage(img, { x, y, width: drawW, height: totalDrawH });
      pageMap.push({
        pageIndex: doc.getPageCount() - 1,
        sectionEl: el,
        canvasW: canvas.width,
        canvasH: canvas.height,
        drawW,
        drawH: totalDrawH,
        x,
        y,
      });
      cursorY += totalDrawH;
    } else {
      // Slice oversized section. Work in canvas pixel space, then re-embed
      // each slice on its own page at full content width.
      const pxPerPt = canvas.width / drawW;
      const sliceHeightPt = contentHeight;
      const sliceHeightPx = Math.floor(sliceHeightPt * pxPerPt);
      // Start oversized sections on a fresh page
      if (cursorY > margin) {
        currentPage = doc.addPage([pageWidth, pageHeight]);
        cursorY = margin;
      }
      let offsetPx = 0;
      let firstSlice = true;
      while (offsetPx < canvas.height) {
        const thisSlicePx = Math.min(sliceHeightPx, canvas.height - offsetPx);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = thisSlicePx;
        const sctx = slice.getContext("2d")!;
        sctx.fillStyle = "#ffffff";
        sctx.fillRect(0, 0, slice.width, slice.height);
        sctx.drawImage(canvas, 0, -offsetPx);
        const sliceBytes = await canvasToJpegBytes(slice);
        const sliceImg = await doc.embedJpg(sliceBytes);
        const sliceDrawH = thisSlicePx / pxPerPt;
        if (!firstSlice) {
          currentPage = doc.addPage([pageWidth, pageHeight]);
          cursorY = margin;
        }
        const x = (pageWidth - drawW) / 2;
        const y = pageHeight - cursorY - sliceDrawH;
        currentPage.drawImage(sliceImg, { x, y, width: drawW, height: sliceDrawH });
        pageMap.push({
          pageIndex: doc.getPageCount() - 1,
          sectionEl: el,
          canvasW: canvas.width,
          canvasH: canvas.height,
          drawW,
          drawH: sliceDrawH,
          x,
          y,
        });
        cursorY += sliceDrawH;
        offsetPx += thisSlicePx;
        firstSlice = false;
      }
    }
  }

  return { doc, pageMap };
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise<Uint8Array>((res) =>
    canvas.toBlob(
      (b) => b!.arrayBuffer().then((ab) => res(new Uint8Array(ab))),
      "image/jpeg",
      0.9,
    ),
  );
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
