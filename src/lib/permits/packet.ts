import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { fileJobDocument } from "@/lib/jobDocuments";
import {
  approvalLabel,
  approvalPdfUrl,
  jobPermitDocuments,
  type JobPermitDocument,
  type ProductApproval,
} from "./db";
import type { PermitContext } from "./context";
import { appendPdf, countPages } from "./rescue";
import {
  docName,
  evaluateCondition,
  resolvePacketStructure,
  type PacketStructure,
  type StructureDoc,
} from "./structures";

/**
 * Assembling the packet the counter actually takes.
 *
 * The checklist tells a contractor what is missing. This produces the artefact:
 * one PDF, in the order the jurisdiction reads it, page-numbered, with a cover
 * sheet that says what is inside and what still needs a signature, a notary or
 * a recording.
 *
 * Three things went wrong in the previous version of this and are fixed here,
 * because between them they accounted for every failed document in the last two
 * real packets it produced:
 *
 *   1. Photos and roof diagrams were dropped. The old merge required the %PDF
 *      magic bytes, so a JPEG uploaded as the site photos — which the manifests
 *      explicitly ask for — could never be included. Images are now embedded as
 *      their own pages.
 *   2. Encrypted approvals threw. Government and manufacturer PDFs are very
 *      often owner-password protected; `ignoreEncryption` is passed everywhere a
 *      document is opened.
 *   3. Approvals were looked up by exact string match on the NOA number, so a
 *      row filed as "NOA No. 22-0123.01" never matched a search for
 *      22-0123.01. The library has since been normalised, and the lookup here
 *      normalises the query side too so old spellings still resolve.
 *
 * Nothing in here signs, notarises, or attests to anything. Where a document
 * needs a human, it is included blank and the cover sheet says who has to sign
 * it. The roof-to-wall affidavit in particular is the owner's sworn statement
 * and the app never ticks it.
 */

export type ItemStatus =
  /** In hand and merged. */
  | "included"
  /** Applies, but nobody has supplied it yet. */
  | "missing"
  /** We have it but could not read it. */
  | "unreadable"
  /** Its condition did not fire. */
  | "not_applicable"
  /** Its condition could not be answered from the job. */
  | "confirm";

export interface PacketItem {
  order: number;
  type: string;
  name: string;
  source: StructureDoc["source"];
  status: ItemStatus;
  /** Where the bytes came from, in words. */
  from: string | null;
  bucket?: string;
  storagePath?: string;
  url?: string;
  pages: number;
  needsSignature: boolean;
  needsNotary: boolean;
  requiresRecording: boolean;
  /** What the human has to do about it, if anything. */
  instruction: string | null;
  note?: string;
}

export interface PacketPlan {
  structure: PacketStructure | null;
  jurisdiction: string;
  items: PacketItem[];
  /** Where the recorded documents get recorded. */
  recording: Record<string, string> | null;
  signature: Record<string, string | string[]> | null;
}

/* ── resolving each manifest line against what the job already holds ── */

/** Uploads filed under an older or shorter key still count. */
const UPLOAD_ALIASES: Record<string, string[]> = {
  coi: ["coi", "insurance", "general_liability", "certificate_of_insurance", "liability_insurance"],
  contractor_license: ["contractor_license", "qualifier_license", "license"],
  workers_comp: ["workers_comp", "workers_compensation", "comp"],
  noc: ["noc", "notice_of_commencement", "signed_noc", "recorded_noc"],
  permit_application: [
    "permit_application",
    "permit_app",
    "application",
    "signed_permit_application",
  ],
  signed_contract: ["signed_contract", "contract"],
  roof_layout: ["roof_layout", "measurement", "measurement_report", "diagram", "roof_diagram"],
  measurement_report: ["measurement_report", "measurement", "roof_layout", "diagram"],
  site_photos: ["site_photos", "photos", "roof_photos"],
  owner_authorization: ["owner_authorization", "owner_auth", "authorization"],
  hoa_affidavit: ["hoa_affidavit", "hoa", "hoa_approval"],
  city_supplement: ["city_supplement", "supplement", "city_form"],
};

function findUpload(type: string, uploaded: JobPermitDocument[]): JobPermitDocument | null {
  const keys = UPLOAD_ALIASES[type] ?? [type];
  const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  for (const k of keys) {
    const hit = uploaded.find((d) => norm(d.doc_key) === k);
    if (hit) return hit;
  }
  /* A signed copy of something we also generate always wins over the blank. */
  return uploaded.find((d) => keys.some((k) => norm(d.doc_key).includes(k))) ?? null;
}

/** Which attached approvals answer this manifest line. */
function productsFor(
  item: StructureDoc,
  products: (ProductApproval & { role: string })[],
): (ProductApproval & { role: string })[] {
  const cat = String(item.product_category ?? "").toLowerCase();
  if (item.type === "product_approvals" && !cat) return products;
  const wantRole = (r: string) => products.filter((p) => p.role === r);
  switch (item.type) {
    case "underlayment_fpa":
      return wantRole("underlayment");
    case "roofing_material_fpa":
      return wantRole("roof_covering");
    case "skylight_noa":
      return products.filter((p) =>
        /skylight/i.test(`${p.product_name ?? ""} ${p.product_category ?? ""}`),
      );
    default:
      break;
  }
  if (cat) {
    return products.filter((p) =>
      `${p.product_category ?? ""} ${p.product_name ?? ""}`.toLowerCase().includes(cat),
    );
  }
  return [];
}

const INSTRUCTIONS: Record<string, string> = {
  noc: "Print it, have the owner sign before a notary, record it with the county Clerk, then upload the recorded copy.",
  permit_application: "Print it, have the qualifier and owner sign, then upload the signed copy.",
  owner_authorization: "Have the owner sign it and upload the signed copy.",
  roof_to_wall_affidavit:
    "This is the owner's sworn statement. The app fills the property details and nothing else — the owner completes and notarises it.",
  roof_to_wall_mitigation:
    "Complete the mitigation form with the connections actually used, then have it notarised.",
  hoa_affidavit: "Get the HOA letter or affidavit and upload it.",
  city_supplement:
    "This city's own form. Add it under Company Documents → City documents so it fills automatically next time.",
  site_photos: "Upload photos of all four elevations of the existing roof.",
  contractor_license: "Add the qualifier's current licence under Company Documents.",
  coi: "Add the current certificate of insurance under Company Documents.",
  workers_comp: "Add current workers comp coverage or the state exemption under Company Documents.",
};

/**
 * The packet as it stands right now: every line the jurisdiction expects, what
 * satisfies it, and what a human still has to do.
 *
 * This runs without touching a single PDF, so the panel can show the real
 * manifest immediately and only pay for the merge when someone asks for it.
 */
export async function planPacket(
  ctx: PermitContext,
  uploaded: JobPermitDocument[],
  opts: { material?: string | null; yearBuilt?: number | null; hasHoa?: boolean | null } = {},
): Promise<PacketPlan> {
  const dept = ctx.department;
  const structure = await resolvePacketStructure({
    county: dept?.county ?? null,
    city: dept?.city ?? null,
    trade: "roofing",
    material: opts.material ?? null,
  });

  const jurisdiction =
    dept?.name ?? ([dept?.city, dept?.county].filter(Boolean).join(", ") || "Florida");
  if (!structure) {
    return { structure: null, jurisdiction, items: [], recording: null, signature: null };
  }

  const facts = {
    yearBuilt: opts.yearBuilt ?? null,
    valuation: ctx.permit?.valuation ?? null,
    hasHoa: opts.hasHoa ?? null,
    hasSkylights: ctx.products.some((p) =>
      /skylight/i.test(`${p.product_name ?? ""} ${p.product_category ?? ""}`),
    ),
    stories: null,
    isMultifamily: null,
  };

  const lines = [
    ...structure.document_structure,
    ...(structure.conditional_documents ?? []).map((d, i) => ({
      ...d,
      order: (structure.document_structure.length ?? 0) + i + 1,
      source: "conditional" as const,
    })),
  ];

  const credential = (kind: string) => ctx.credentials.find((c) => c.kind === kind);
  const items: PacketItem[] = [];

  for (const [i, line] of lines.entries()) {
    const base = {
      order: line.order ?? i + 1,
      type: line.type,
      name: docName(line.type),
      source: line.source,
      pages: 0,
      needsSignature: !!line.needs_signature,
      needsNotary: !!line.needs_notary,
      requiresRecording: !!line.requires_recording,
      instruction: INSTRUCTIONS[line.type] ?? null,
    };

    /* A conditional line that does not apply is shown as such rather than
       hidden: a contractor who cannot see why the affidavit is absent will go
       and add it by hand anyway. */
    if (line.condition) {
      const applies = evaluateCondition(line.condition, facts);
      if (applies === false) {
        items.push({ ...base, status: "not_applicable", from: null, note: readCondition(line.condition) });
        continue;
      }
      if (applies === null) {
        items.push({
          ...base,
          status: "confirm",
          from: null,
          note: `Cannot tell from this job — ${readCondition(line.condition)}`,
        });
        continue;
      }
    }

    if (line.type === "cover_sheet") {
      items.push({ ...base, status: "included", from: "generated here", pages: 1 });
      continue;
    }

    /* An uploaded copy beats anything we could produce, always. A recorded NOC
       or a signed application is the document the counter wants; our blank is
       only a means to get one. */
    const up = findUpload(line.type, uploaded);
    if (up) {
      items.push({
        ...base,
        status: "included",
        from: "uploaded on this job",
        bucket: up.bucket,
        storagePath: up.storage_path,
      });
      continue;
    }

    switch (line.type) {
      case "contractor_license":
      case "coi":
      case "workers_comp": {
        const kind =
          line.type === "contractor_license"
            ? "qualifier_license"
            : line.type === "coi"
              ? "general_liability"
              : "workers_comp";
        const cred = credential(kind) ?? (kind === "workers_comp" ? credential("workers_comp_exemption") : undefined);
        if (cred?.storage_path) {
          const lapsed = cred.expires_on ? new Date(cred.expires_on).getTime() < Date.now() : false;
          items.push({
            ...base,
            status: lapsed ? "missing" : "included",
            from: "company credentials",
            bucket: cred.bucket,
            storagePath: cred.storage_path,
            note: lapsed ? `Expired ${cred.expires_on}. The counter will reject it.` : undefined,
          });
        } else {
          items.push({ ...base, status: "missing", from: null });
        }
        continue;
      }
      case "signed_contract":
        items.push(
          ctx.contractUrl
            ? { ...base, status: "included", from: "the signed contract on this job", url: ctx.contractUrl }
            : { ...base, status: "missing", from: null },
        );
        continue;
      case "roof_layout":
      case "measurement_report":
        items.push(
          ctx.measurementUrl
            ? { ...base, status: "included", from: "the measurement on this job", url: ctx.measurementUrl }
            : { ...base, status: "missing", from: null },
        );
        continue;
      default:
        break;
    }

    if (line.source === "auto_source") {
      const matched = productsFor(line, ctx.products);
      const withPdf = matched.filter((p) => approvalPdfUrl(p));
      if (withPdf.length) {
        for (const [n, p] of withPdf.entries()) {
          items.push({
            ...base,
            order: base.order + n / 100,
            name: `${base.name} — ${approvalLabel(p)}`,
            status: "included",
            from: "the product approval library",
            url: approvalPdfUrl(p)!,
          });
        }
      } else if (matched.length) {
        items.push({
          ...base,
          status: "missing",
          from: null,
          note: `${matched.length} approval${matched.length === 1 ? "" : "s"} attached but no PDF on file yet.`,
        });
      } else {
        items.push({ ...base, status: "missing", from: null });
      }
      continue;
    }

    /* auto_fill, city_specific and anything else: we can produce it, but the
       filled form is generated by the form filler on the panel, not here. */
    items.push({ ...base, status: "missing", from: null });
  }

  items.sort((a, b) => a.order - b.order);

  return {
    structure,
    jurisdiction,
    items,
    recording: structure.recording_requirements,
    signature: structure.signature_requirements,
  };
}

function readCondition(c: string): string {
  switch (c) {
    case "if_hoa":
      return "applies when the property is in an HOA";
    case "if_skylights":
      return "applies when there are skylights";
    case "if_pre_1988":
      return "applies to structures built before 1988";
    case "if_pre_1994":
      return "applies to structures built before 1994";
    case "if_pre_2002":
      return "applies to structures built before 2002";
    case "if_over_300k":
      return "applies when the job value is over $300,000";
    case "if_pre_1988_and_over_300k":
      return "applies to pre-1988 structures over $300,000";
    case "if_pre_1994_or_over_300k":
      return "applies to pre-1994 structures, or any job over $300,000";
    case "if_over_30ft_or_multifamily":
      return "applies over 30ft or to multifamily";
    case "if_change_of_plan":
      return "applies only on a revision";
    default:
      return "condition not recognised — check whether this jurisdiction wants it";
  }
}

/* ── turning the plan into one PDF ── */

interface Fetched {
  bytes: Uint8Array;
  kind: "pdf" | "image";
  mime: string;
}

async function fetchBytes(item: PacketItem): Promise<Fetched | null> {
  try {
    let blob: Blob | null = null;
    if (item.bucket && item.storagePath) {
      const { data, error } = await supabase.storage.from(item.bucket).download(item.storagePath);
      if (error || !data) return null;
      blob = data;
    } else if (item.url) {
      const r = await fetch(item.url);
      if (!r.ok) return null;
      blob = await r.blob();
    }
    if (!blob) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    /* Trust the bytes, not the content type. Storage hands back
       application/octet-stream for plenty of real PDFs, and a county portal
       will hand back an HTML error page labelled application/pdf. */
    const head = String.fromCharCode(...bytes.slice(0, 5));
    if (head.startsWith("%PDF")) return { bytes, kind: "pdf", mime: "application/pdf" };
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, kind: "image", mime: "image/jpeg" };
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, kind: "image", mime: "image/png" };
    return null;
  } catch {
    return null;
  }
}

const LETTER: [number, number] = [612, 792];

/**
 * A photo is a document too.
 *
 * Every manifest that asks for site photos or a roof diagram gets them as
 * phone photos, and the previous assembler dropped all of them because they
 * were not PDFs. Each image becomes one page, scaled to fit inside a margin
 * with its aspect ratio kept, captioned so the examiner knows what they are
 * looking at.
 */
async function addImagePage(out: PDFDocument, f: Fetched, caption: string, font: PDFFont) {
  /* pdf-lib's image embedders read through `bytes.buffer` and ignore
     byteOffset, so a view into a larger buffer is misread as "SOI not found".
     A view is what you get from a Node Buffer and from some polyfilled fetches,
     so the bytes are copied into a buffer they own before embedding. */
  const own = new Uint8Array(f.bytes.length);
  own.set(f.bytes);
  const img = f.mime === "image/png" ? await out.embedPng(own) : await out.embedJpg(own);
  const page = out.addPage(LETTER);
  const margin = 40;
  const capH = 24;
  const maxW = LETTER[0] - margin * 2;
  const maxH = LETTER[1] - margin * 2 - capH;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, {
    x: (LETTER[0] - w) / 2,
    y: margin + capH + (maxH - h) / 2,
    width: w,
    height: h,
  });
  page.drawText(caption.slice(0, 90), {
    x: margin,
    y: margin,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
}

/** ASCII only: the standard fonts are WinAnsi and a tick mark throws. */
function mark(status: ItemStatus): string {
  switch (status) {
    case "included":
      return "[X]";
    case "missing":
      return "[ ]";
    case "unreadable":
      return "[!]";
    case "confirm":
      return "[?]";
    case "not_applicable":
      return "[-]";
  }
}

interface CoverInfo {
  jurisdiction: string;
  ownerName: string;
  address: string;
  valuation: string;
  hvhz: boolean;
  scope: string;
  company: string;
  licence: string;
}

/**
 * The cover sheet is drawn, not written by a model.
 *
 * It is the first page a plans examiner reads and every line on it is a claim
 * about what is in the envelope. A generated sentence that is 95% right is
 * worse here than a plain table that is right, so this reads straight off the
 * resolved plan.
 */
function drawCover(
  out: PDFDocument,
  plan: PacketPlan,
  info: CoverInfo,
  fonts: { regular: PDFFont; bold: PDFFont },
) {
  let page = out.addPage(LETTER);
  const { regular, bold } = fonts;
  const left = 50;
  let y = LETTER[1] - 56;

  const line = (text: string, opts: { size?: number; font?: PDFFont; gap?: number; color?: [number, number, number] } = {}) => {
    const size = opts.size ?? 10;
    if (y < 60) {
      page = out.addPage(LETTER);
      y = LETTER[1] - 56;
    }
    page.drawText(text.replace(/[^\x20-\x7E]/g, "-").slice(0, 110), {
      x: left,
      y,
      size,
      font: opts.font ?? regular,
      color: opts.color ? rgb(...opts.color) : rgb(0.1, 0.1, 0.1),
    });
    y -= opts.gap ?? size + 5;
  };
  const rule = () => {
    if (y < 60) {
      page = out.addPage(LETTER);
      y = LETTER[1] - 56;
    }
    page.drawLine({
      start: { x: left, y: y + 6 },
      end: { x: LETTER[0] - left, y: y + 6 },
      thickness: 0.75,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 10;
  };

  line("PERMIT SUBMITTAL PACKAGE", { size: 17, font: bold, gap: 22 });
  line(info.jurisdiction, { size: 12, font: bold, gap: 6 });
  if (info.hvhz) line("High Velocity Hurricane Zone", { size: 9, color: [0.45, 0.2, 0.2], gap: 14 });
  rule();

  line("PROPERTY", { size: 9, font: bold, gap: 14 });
  line(info.address);
  line(`Owner: ${info.ownerName}`);
  line(`Valuation: ${info.valuation}`);
  if (info.scope) line(`Scope: ${info.scope.slice(0, 95)}`, { gap: 18 });
  else y -= 8;

  line("CONTRACTOR", { size: 9, font: bold, gap: 14 });
  line(info.company);
  line(`License: ${info.licence}`, { gap: 18 });
  rule();

  line("CONTENTS", { size: 9, font: bold, gap: 14 });
  for (const it of plan.items) {
    if (it.type === "cover_sheet") continue;
    const suffix: string[] = [];
    if (it.needsSignature) suffix.push("signature");
    if (it.needsNotary) suffix.push("notary");
    if (it.requiresRecording) suffix.push("recorded");
    const tail = suffix.length ? `  (${suffix.join(", ")})` : "";
    const missing = it.status === "missing";
    line(`${mark(it.status)} ${it.name}${tail}`, {
      size: 9.5,
      gap: 13,
      color: missing ? [0.6, 0.15, 0.15] : undefined,
    });
  }
  y -= 6;
  rule();

  const outstanding = plan.items.filter((i) => i.status === "missing");
  const confirm = plan.items.filter((i) => i.status === "confirm");
  if (outstanding.length === 0 && confirm.length === 0) {
    line("Every document this jurisdiction requires is present.", { size: 9, font: bold, gap: 16 });
  } else {
    line("STILL NEEDED BEFORE SUBMISSION", { size: 9, font: bold, color: [0.6, 0.15, 0.15], gap: 14 });
    for (const it of outstanding) {
      line(`- ${it.name}${it.instruction ? `: ${it.instruction}` : ""}`, { size: 8.5, gap: 12 });
    }
    for (const it of confirm) {
      line(`? ${it.name}: ${it.note ?? "confirm whether this applies"}`, { size: 8.5, gap: 12 });
    }
    y -= 6;
  }

  if (plan.recording) {
    rule();
    line("RECORDING", { size: 9, font: bold, gap: 13 });
    for (const [doc, where] of Object.entries(plan.recording)) {
      line(`${docName(doc)} is recorded with ${where}.`, { size: 8.5, gap: 12 });
    }
  }

  line("", { gap: 6 });
  line(
    "This cover sheet lists what is in this package. Nothing in it has been signed, notarised or",
    { size: 7.5, color: [0.45, 0.45, 0.45], gap: 10 },
  );
  line("attested to on anyone's behalf.", { size: 7.5, color: [0.45, 0.45, 0.45], gap: 10 });
}

function stampPageNumbers(out: PDFDocument, font: PDFFont) {
  const pages = out.getPages();
  pages.forEach((p: PDFPage, i: number) => {
    const { width } = p.getSize();
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, {
      x: width - 50 - font.widthOfTextAtSize(label, 8),
      y: 22,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  });
}

export interface AssembledPacket {
  bytes: Uint8Array;
  fileName: string;
  /** The plan as it ended up, with real page counts and any read failures. */
  plan: PacketPlan;
  totalPages: number;
}

/**
 * Merge everything the plan resolved into one document.
 *
 * A document that cannot be read is recorded as `unreadable` and the packet
 * carries on without it. That is deliberate: a contractor who gets nothing back
 * because one manufacturer's NOA is malformed has no idea which one, whereas a
 * packet that is 19 documents long with one line flagged is a packet they can
 * fix in a minute.
 */
export async function assemblePacket(
  plan: PacketPlan,
  info: CoverInfo,
): Promise<AssembledPacket> {
  const out = await PDFDocument.create();
  const regular = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);

  /* Read everything first so the cover sheet can tell the truth about what
     actually made it in, rather than what we hoped would. */
  const resolved: PacketItem[] = [];
  const payloads = new Map<PacketItem, Fetched>();
  for (const item of plan.items) {
    if (item.type === "cover_sheet" || item.status !== "included") {
      resolved.push(item);
      continue;
    }
    const got = await fetchBytes(item);
    if (!got) {
      resolved.push({ ...item, status: "unreadable", note: "Could not read this file." });
      continue;
    }
    let pages = 1;
    if (got.kind === "pdf") {
      try {
        pages = await countPages(got.bytes);
      } catch {
        resolved.push({ ...item, status: "unreadable", note: "This PDF could not be opened." });
        continue;
      }
    }
    const withPages = { ...item, pages };
    payloads.set(withPages, got);
    resolved.push(withPages);
  }

  const finalPlan: PacketPlan = { ...plan, items: resolved };
  drawCover(out, finalPlan, info, { regular, bold });

  for (const item of resolved) {
    const got = payloads.get(item);
    if (!got) continue;
    try {
      if (got.kind === "image") {
        await addImagePage(out, got, item.name, regular);
        continue;
      }
      /* appendPdf falls back to rendering when pdf-lib cannot open the file,
         which is close to half of the approval library. See rescue.ts. */
      const r = await appendPdf(out, got.bytes, { label: item.name, font: regular });
      if (r.rasterised) {
        item.note = "Included as page images — this file's structure is one pdf-lib cannot copy.";
      }
    } catch {
      /* Already counted above; a failure here leaves the pages out and the
         cover sheet's count is the one the reader sees. */
    }
  }

  stampPageNumbers(out, regular);
  const bytes = await out.save();
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    bytes,
    fileName: `permit-packet-${stamp}.pdf`,
    plan: finalPlan,
    totalPages: out.getPageCount(),
  };
}

/**
 * Build it, put it in the job's Documents tab, and hand it back to download.
 *
 * The packet is filed under the job like every other document the app
 * produces, so a week later nobody has to remember which tab it came from.
 */
export async function buildAndFilePacket(opts: {
  ctx: PermitContext;
  uploaded: JobPermitDocument[];
  info: CoverInfo;
  permitId: string | null;
  material?: string | null;
  yearBuilt?: number | null;
  hasHoa?: boolean | null;
}): Promise<{ packet: AssembledPacket; downloadUrl: string; filed: boolean }> {
  const plan = await planPacket(opts.ctx, opts.uploaded, {
    material: opts.material,
    yearBuilt: opts.yearBuilt,
    hasHoa: opts.hasHoa,
  });
  if (!plan.structure) {
    throw new Error(
      `No packet layout on file for ${plan.jurisdiction} yet. The checklist still applies — the ordered packet needs this jurisdiction mapped first.`,
    );
  }

  const packet = await assemblePacket(plan, opts.info);
  const blob = new Blob([packet.bytes as unknown as BlobPart], { type: "application/pdf" });
  const downloadUrl = URL.createObjectURL(blob);

  const path = `${opts.ctx.companyId}/${opts.ctx.jobId}/${Date.now()}-${packet.fileName}`;
  let filed = false;
  try {
    const { error } = await supabase.storage
      .from("job-documents")
      .upload(path, blob, { contentType: "application/pdf", upsert: false });
    if (!error) {
      filed = await fileJobDocument({
        jobId: opts.ctx.jobId,
        companyId: opts.ctx.companyId,
        kind: "permit",
        title: `Permit packet — ${plan.jurisdiction}`,
        bucket: "job-documents",
        storagePath: path,
        mimeType: "application/pdf",
        fileSize: blob.size,
        sourceTable: "job_permits",
        sourceId: opts.permitId,
      });
      if (opts.permitId) {
        try {
          await jobPermitDocuments().insert({
            permit_id: opts.permitId,
            company_id: opts.ctx.companyId,
            doc_key: "permit_packet",
            title: `Permit packet — ${plan.jurisdiction}`,
            origin: "generated",
            bucket: "job-documents",
            storage_path: path,
            file_name: packet.fileName,
            status: "draft",
          });
        } catch {
          /* The packet is filed on the job either way. */
        }
      }
    }
  } catch {
    /* The download still works; filing is the convenience, not the deliverable. */
  }

  return { packet, downloadUrl, filed };
}
