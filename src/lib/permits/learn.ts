import { PDFDocument } from "pdf-lib";
import type { SourceKey } from "./context";
import { permitFormTemplates } from "./db";

/**
 * Learning a city's form so the next person does not have to.
 *
 * There are roughly 19,900 permit-issuing jurisdictions in the United States.
 * Nobody is going to hand-map them. But a contractor who already files in a
 * city has that city's form, and mapping one takes minutes rather than the
 * hours it takes to find it in the first place. So the app learns from the
 * form itself, and the map is shared: mapped once, by anyone, for everyone.
 *
 * Two kinds of form come through here.
 *
 *   A fillable form carries an AcroForm. The field names are the map, and a
 *   filled example lets us read a value out of each one and say what it holds.
 *
 *   A scanned form carries nothing — no fields, often no text layer. Those are
 *   read by rendering each page and running OCR over it, then pairing the
 *   value the example carries with the label printed beside it. The pairing
 *   produces a coordinate, which is what `fill_method: 'stamp'` consumes.
 *
 * The heavy readers — pdf.js and tesseract — are pulled from a CDN the first
 * time somebody opens the learner rather than bundled, because most sessions
 * never open it and together they are several megabytes.
 */

/* ── what a value looks like, so a filled example can be read back ──────── */

interface Matcher {
  key: SourceKey;
  /** Words that appear in the printed label beside this field. */
  labels: RegExp;
  /** What a value for this field looks like, when that is distinctive. */
  value?: RegExp;
}

const MATCHERS: Matcher[] = [
  { key: "folio", labels: /folio|parcel|map\s*\/?\s*parcel|property\s*id|pin\b/i, value: /^[\d-]{9,}$/ },
  { key: "property_address", labels: /(job|property|site|project)\s*(address|location)|address of (job|property)/i },
  { key: "property_city", labels: /^city\b|city\s*\/?\s*state/i },
  { key: "property_state", labels: /^state\b/i, value: /^[A-Z]{2}$/ },
  { key: "property_zip", labels: /zip|postal/i, value: /^\d{5}(-\d{4})?$/ },
  { key: "legal_description", labels: /legal\s*desc/i },
  { key: "square_footage", labels: /square\s*(footage|feet)|sq\.?\s*ft/i },
  { key: "valuation", labels: /valuation|value of work|estimated cost|job cost|contract (price|amount)/i },
  { key: "scope_description", labels: /description of work|scope|work description|nature of work/i },
  { key: "owner_name", labels: /owner'?s?\s*name|property owner|owner\b(?!.*address)/i },
  { key: "owner_phone", labels: /owner.*(phone|tel)/i },
  { key: "owner_email", labels: /owner.*e-?mail/i, value: /@/ },
  { key: "owner_address", labels: /owner.*address|mailing address/i },
  { key: "contractor_company", labels: /contractor'?s?\s*(company|name|business)|company name|qualifier'?s? company/i },
  { key: "contractor_phone", labels: /contractor.*(phone|tel)/i },
  { key: "contractor_email", labels: /contractor.*e-?mail/i, value: /@/ },
  { key: "contractor_address", labels: /contractor.*address/i },
  { key: "qualifier_name", labels: /qualifier|qualifying agent/i },
  { key: "license_number", labels: /licen[cs]e\s*(#|no|number)|state licen[cs]e|cert(ificate)?\s*(#|no)/i, value: /^[A-Z]{2,4}\s?\d{4,}$/i },
  { key: "lender_name", labels: /lender|mortgagee/i },
  { key: "surety_name", labels: /surety|bonding company/i },
  { key: "today", labels: /^date\b|date of application|application date/i, value: /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/ },
];

/** Best guess at what a field holds, from its label and — if present — its value. */
export function guessKey(label: string, value?: string): { key: SourceKey; confidence: number } | null {
  const l = (label || "").trim();
  const v = (value || "").trim();
  let best: { key: SourceKey; confidence: number } | null = null;
  for (const m of MATCHERS) {
    let c = 0;
    if (l && m.labels.test(l)) c += 0.7;
    if (v && m.value && m.value.test(v)) c += 0.35;
    // A value that looks right but a label that does not is a weak guess.
    if (c > 0 && (!best || c > best.confidence)) best = { key: m.key, confidence: Math.min(c, 1) };
  }
  return best && best.confidence >= 0.34 ? best : null;
}

/* ── the result of reading a form ───────────────────────────────────────── */

export type FillMethod = "acroform" | "stamp";

export interface LearnedField {
  /** AcroForm field name, or a synthetic id for a stamped field. */
  name: string;
  /** The label printed beside it, as read off the page. */
  label: string;
  /** What the example had in it, when there was an example. */
  sample?: string;
  /** The job value we think belongs here. Null means the user picks. */
  key: SourceKey | null;
  confidence: number;
  page: number;
  /** Only for stamped fields: where the value goes, in PDF points. */
  x?: number;
  y?: number;
  size?: number;
}

export interface LearnedForm {
  fillMethod: FillMethod;
  pageCount: number;
  fields: LearnedField[];
  /** Pages with no text and no fields — a scan the reader could not open. */
  unreadablePages: number[];
  notes: string[];
}

/* ── the fillable case: pdf-lib, already bundled ────────────────────────── */

async function learnAcroForm(bytes: ArrayBuffer): Promise<LearnedForm | null> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const raw = form.getFields();
  if (!raw.length) return null;

  const fields: LearnedField[] = [];
  for (const f of raw) {
    const name = f.getName();
    let sample = "";
    // Only text fields carry a readable value; the rest are mapped by name.
    const anyF = f as unknown as { getText?: () => string | undefined };
    try {
      sample = anyF.getText?.() ?? "";
    } catch {
      sample = "";
    }
    // The field name is the only label a fillable form gives us.
    const label = name.replace(/[._-]+/g, " ").trim();
    const guess = guessKey(label, sample);
    fields.push({
      name,
      label,
      sample: sample || undefined,
      key: guess?.key ?? null,
      confidence: guess?.confidence ?? 0,
      page: 1,
    });
  }

  return {
    fillMethod: "acroform",
    pageCount: doc.getPageCount(),
    fields,
    unreadablePages: [],
    notes: [
      `${raw.length} form fields found. Names come from the PDF, so the label column is only as good as whoever built the form.`,
    ],
  };
}

/* ── the scanned case: pdf.js + tesseract, fetched when first needed ────── */

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";
const TESS_URL = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.esm.min.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPdfjs(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(/* @vite-ignore */ PDFJS_URL);
  mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return mod;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTesseract(): Promise<any> {
  return await import(/* @vite-ignore */ TESS_URL);
}

interface Word {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  conf: number;
}

/** Words on a line, left to right, grouped by baseline. */
function lines(words: Word[]): Word[][] {
  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Word[][] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0].y - w.y) <= Math.max(4, w.h * 0.6)) last.push(w);
    else out.push([w]);
  }
  out.forEach((l) => l.sort((a, b) => a.x - b.x));
  return out;
}

const isLabelish = (s: string) => /[A-Za-z]/.test(s) && s === s.toUpperCase() && s.length > 2;

/**
 * Pair each value on the page with the label printed above or to the left of
 * it, which is how these forms are laid out. The value's position becomes the
 * coordinate the filler stamps at.
 */
function pairLabelsAndValues(words: Word[], page: number): LearnedField[] {
  const rows = lines(words);
  const fields: LearnedField[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const above = rows[i - 1];
    if (!above) continue;

    // A header row of ALL-CAPS labels with a value row under it is the common
    // shape on a county form: OWNERS NAME / PERMIT NUMBER / DATE, values below.
    const headerish = above.filter((w) => isLabelish(w.text)).length >= Math.ceil(above.length * 0.6);
    if (!headerish) continue;

    // Cluster the header into labels by horizontal gaps.
    const groups: Word[][] = [];
    for (const w of above) {
      const g = groups[groups.length - 1];
      if (g && w.x - (g[g.length - 1].x + g[g.length - 1].w) < 26) g.push(w);
      else groups.push([w]);
    }

    for (const g of groups) {
      const label = g.map((w) => w.text).join(" ");
      const lx = g[0].x;
      // The value under this label starts nearest its left edge.
      const val = row.filter((w) => w.x >= lx - 14 && w.x < lx + 260);
      if (!val.length) continue;
      const sample = val.map((w) => w.text).join(" ");
      const guess = guessKey(label, sample);
      if (!guess) continue;
      fields.push({
        name: `${guess.key}_p${page}`,
        label,
        sample,
        key: guess.key,
        confidence: guess.confidence,
        page,
        x: Math.round(val[0].x * 10) / 10,
        y: Math.round((val[0].y + val[0].h) * 10) / 10,
        size: Math.max(7, Math.min(11, Math.round(val[0].h))),
      });
    }
  }

  // One field per job value per page — the first pairing is the reliable one.
  const seen = new Set<string>();
  return fields.filter((f) => (seen.has(f.name) ? false : (seen.add(f.name), true)));
}

async function learnScanned(bytes: ArrayBuffer, onProgress?: (s: string) => void): Promise<LearnedForm> {
  const pdfjs = await loadPdfjs();
  const tess = await loadTesseract();
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;

  const fields: LearnedField[] = [];
  const unreadable: number[] = [];
  // Reading every page of a 100-page packet is not what this is for.
  const pages = Math.min(doc.numPages, 8);
  const worker = await tess.createWorker("eng");

  try {
    for (let p = 1; p <= pages; p++) {
      onProgress?.(`Reading page ${p} of ${pages}…`);
      const page = await doc.getPage(p);
      // ~300dpi against a 72dpi page, which is what OCR wants.
      const viewport = page.getViewport({ scale: 300 / 72 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = (data as any).words ?? [];
      const S = 72 / 300; // back to PDF points
      const words: Word[] = raw
        .filter((w) => (w.text || "").trim())
        .map((w) => ({
          text: String(w.text).trim(),
          x: w.bbox.x0 * S,
          y: w.bbox.y0 * S,
          w: (w.bbox.x1 - w.bbox.x0) * S,
          h: (w.bbox.y1 - w.bbox.y0) * S,
          conf: w.confidence ?? 0,
        }));

      if (words.length < 12) unreadable.push(p);
      fields.push(...pairLabelsAndValues(words, p));
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await worker.terminate();
  }

  const notes = [
    `Read ${pages} page${pages === 1 ? "" : "s"} by OCR. Coordinates are in PDF points from the top-left of each page.`,
  ];
  if (doc.numPages > pages) notes.push(`Only the first ${pages} pages were read — the rest were skipped.`);
  if (unreadable.length) notes.push(`Pages ${unreadable.join(", ")} came back nearly empty; check they are not photographs.`);
  notes.push("Every coordinate came from where the example's own values sat. Check the first filled copy before it goes to a counter.");

  return { fillMethod: "stamp", pageCount: doc.numPages, fields, unreadablePages: unreadable, notes };
}

/* ── the entry point ────────────────────────────────────────────────────── */

/**
 * Read a city's form and propose a field map.
 *
 * A filled example teaches far more than a blank one, because the values are
 * what tell us which field is which. A blank form still yields the AcroForm
 * names, which is enough for a fillable form and nothing at all for a scan.
 */
export async function learnForm(
  file: File,
  onProgress?: (s: string) => void,
): Promise<LearnedForm> {
  const bytes = await file.arrayBuffer();
  onProgress?.("Looking for form fields…");
  try {
    const acro = await learnAcroForm(bytes);
    if (acro) return acro;
  } catch (e) {
    console.warn("could not read this PDF as a fillable form", e);
  }
  onProgress?.("No form fields — reading the page instead…");
  return await learnScanned(bytes, onProgress);
}

/* ── saving the map, shared with everyone ───────────────────────────────── */

export interface SaveTemplateInput {
  buildingDeptId: string;
  jurisdictionName: string;
  county?: string | null;
  city?: string | null;
  formType: string;
  formName: string;
  /** Public URL of the blank form in the shared template bucket. */
  filePath: string;
  learned: LearnedForm;
  pageCount?: number;
}

/**
 * `permit_form_templates` carries no company_id on purpose: a city's form is
 * the city's, not any one contractor's. A map written by one company is used
 * by every company filing in that jurisdiction, which is the only way this
 * reaches the whole country. The uploaded example stays private to the company
 * that uploaded it — only the blank form and the map are shared.
 */
export async function saveLearnedTemplate(input: SaveTemplateInput): Promise<void> {
  const mapping: Record<string, unknown> = {};
  for (const f of input.learned.fields) {
    if (!f.key) continue;
    mapping[f.name] =
      input.learned.fillMethod === "acroform"
        ? { source: f.key }
        : { source: f.key, page: f.page, x: f.x, y: f.y, size: f.size ?? 9 };
  }

  const { error } = await permitFormTemplates().insert({
    building_dept_id: input.buildingDeptId,
    jurisdiction_name: input.jurisdictionName,
    county: input.county ?? null,
    city: input.city ?? null,
    form_type: input.formType,
    form_name: input.formName,
    file_path: input.filePath,
    field_mapping: mapping,
    fill_method: input.learned.fillMethod,
    is_fillable: input.learned.fillMethod === "acroform",
    field_count: Object.keys(mapping).length,
    page_count: input.pageCount ?? input.learned.pageCount,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  if (error) throw error;
}
