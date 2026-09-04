import { PDFDocument, type PDFFont } from "pdf-lib";

/**
 * Getting a document into the packet when pdf-lib cannot open it.
 *
 * This exists because of a measurement, not a hunch. Sampling 35 approvals at
 * random out of the library, **17 of them could not be opened by pdf-lib at
 * all** — a little under half. Every one fails the same way, on the catalog's
 * page tree:
 *
 *     Expected instance of PDFDict, but got instance of undefined
 *
 * They are not corrupt and they are not encrypted. pdf.js and MuPDF read all of
 * them without complaint, and the text comes out clean. Miami-Dade's document
 * system writes cross-reference streams in a shape pdf-lib will not follow, and
 * since Miami-Dade is where NOAs come from, that shape is roughly half the
 * library.
 *
 * That single fact explains the previous assembler's output better than
 * anything else: its last real packet listed six approvals as unsourced and one
 * as `parse_failed`, and it merged 11 pages when the manifest called for
 * something closer to 40.
 *
 * The durable fix is to rewrite those files once — MuPDF's clean pass produces
 * a byte-identical-looking PDF that pdf-lib opens happily, and
 * `scripts/repair-approvals.mjs` does exactly that. Until that has been run
 * over the whole bucket, this keeps the document in the packet: pdf.js renders
 * each page and the image goes in instead. The pages look right and print
 * right; what is lost is the selectable text layer, which is why this is the
 * fallback and not the plan.
 */

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

/** 144dpi: legible at full zoom, and a 30-page NOA still lands under 8MB. */
const SCALE = 2;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjs: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadPdfjs(): Promise<any> {
  pdfjs ??= import(/* @vite-ignore */ PDFJS_URL).then((mod) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mod as any).GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return mod;
  });
  return pdfjs;
}

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob((b) => res(b), "image/jpeg", 0.82),
  );
  if (!blob) throw new Error("could not encode the page");
  return new Uint8Array(await blob.arrayBuffer());
}

export interface RescueResult {
  pages: number;
  /** True when the pages went in as images rather than as vector PDF. */
  rasterised: boolean;
}

/**
 * Append `bytes` to `out`, whatever it takes.
 *
 * Tries the clean path first — pdf-lib copies the pages and the text survives.
 * Only on failure does it fall back to rendering. The caller is told which
 * happened so the cover sheet and the panel can say so rather than quietly
 * degrading the packet.
 */
export async function appendPdf(
  out: PDFDocument,
  bytes: Uint8Array,
  opts: { label?: string; font?: PDFFont } = {},
): Promise<RescueResult> {
  try {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const p of copied) out.addPage(p);
    return { pages: copied.length, rasterised: false };
  } catch {
    /* Fall through — this is the common case, not an exceptional one. */
  }

  const mod = await loadPdfjs();
  /* pdf.js takes ownership of the buffer it is given, and pdf-lib may still
     hold a view on ours. */
  const doc = await mod.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  let added = 0;
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      /* White ground: a transparent PDF page renders as black in a JPEG. */
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const jpg = await canvasToJpeg(canvas);
      const img = await out.embedJpg(jpg);
      /* Back to PDF points, so the page is the size the original was. */
      const pdfPage = out.addPage([viewport.width / SCALE, viewport.height / SCALE]);
      pdfPage.drawImage(img, {
        x: 0,
        y: 0,
        width: viewport.width / SCALE,
        height: viewport.height / SCALE,
      });
      added++;

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await doc.destroy?.();
  }

  return { pages: added, rasterised: true };
}

/**
 * How many pages a document has, without merging it.
 *
 * The panel wants a page count before anyone asks for a build, and half the
 * library will not answer that question through pdf-lib.
 */
export async function countPages(bytes: Uint8Array): Promise<number> {
  try {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return src.getPageCount();
  } catch {
    const mod = await loadPdfjs();
    const doc = await mod.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
    const n = doc.numPages;
    await doc.destroy?.();
    return n;
  }
}
