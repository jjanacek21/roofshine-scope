/**
 * Claim Buddy report PDF.
 *
 * Letter, 0.5in margins, company logo in the header of every page, company
 * name + license + page number in the footer, and photos are placed whole —
 * a photo block never straddles a page break.
 *
 * Rendered from the same report payload the on-screen report uses, so the two
 * can never drift. (No window.print(), no browser dialog.)
 */
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { cbPhotoSignedUrl } from "@/lib/cbPhotos";
import { CB_ELEVATIONS, CB_ELEVATION_LABEL } from "@/lib/cbTakeoff";
import { licenseList, type CbReportViewModel } from "@/components/cb/CbReportDoc";
import { CB_PHOTO_CATEGORY_LABEL, type CbReportPhoto } from "@/lib/cbReport";

export const CB_DOC_BUCKET = "cb-documents";

const PAGE_W = 612;
const PAGE_H = 792;
const M = 36; // 0.5 inch
const CONTENT_W = PAGE_W - M * 2;
const FOOTER_TOP = PAGE_H - 46;

async function toDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 4, h: 3 });
      img.src = data;
    });
    return { data, ...dims };
  } catch {
    return null;
  }
}

export interface CbPdfProgress {
  (step: string): void;
}

export async function renderReportPdf(vm: CbReportViewModel, onStep?: CbPdfProgress): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const company = vm.company;
  const licenses = licenseList(company?.license_numbers);
  const footerText = [company?.legal_name || company?.name, licenses.length ? `License ${licenses.join(", ")}` : null]
    .filter(Boolean)
    .join("  ·  ");

  onStep?.("Loading branding…");
  const logo = vm.logoUrl ? await toDataUrl(vm.logoUrl) : null;

  let y = M;
  let page = 1;

  function header() {
    if (logo) {
      const h = 26;
      const w = Math.min(140, (logo.w / logo.h) * h);
      doc.addImage(logo.data, "PNG", M, M - 10, w, h, undefined, "FAST");
    } else {
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
      doc.text(String(company?.name ?? ""), M, M + 6);
    }
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
    doc.text("Property Damage Inspection Report", PAGE_W - M, M + 4, { align: "right" });
    doc.setDrawColor(220).line(M, M + 22, PAGE_W - M, M + 22);
  }

  function footer() {
    doc.setDrawColor(226).line(M, FOOTER_TOP, PAGE_W - M, FOOTER_TOP);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    doc.text(footerText, M, FOOTER_TOP + 14);
    doc.text(`Page ${page}`, PAGE_W - M, FOOTER_TOP + 14, { align: "right" });
  }

  function newPage() {
    footer();
    doc.addPage();
    page += 1;
    header();
    y = M + 40;
  }

  /** Reserve vertical space; break the page when the block does not fit whole. */
  function need(h: number) {
    if (y + h > FOOTER_TOP - 12) newPage();
  }

  function h1(text: string) {
    need(34);
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(20);
    doc.text(text, M, y);
    y += 8;
    doc.setDrawColor(200).line(M, y, PAGE_W - M, y);
    y += 14;
  }

  function h2(text: string) {
    need(24);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(40);
    doc.text(text, M, y);
    y += 14;
  }

  function para(text: string, size = 10) {
    if (!text) return;
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(45);
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    for (const line of lines) {
      need(size + 4);
      doc.text(line, M, y);
      y += size + 4;
    }
    y += 4;
  }

  function kv(pairs: [string, string][], cols = 2) {
    const colW = CONTENT_W / cols;
    doc.setFontSize(9.5);
    for (let i = 0; i < pairs.length; i += cols) {
      need(16);
      for (let c = 0; c < cols; c++) {
        const pair = pairs[i + c];
        if (!pair) continue;
        const x = M + c * colW;
        doc.setFont("helvetica", "normal").setTextColor(120);
        doc.text(pair[0], x, y);
        doc.setFont("helvetica", "bold").setTextColor(30);
        doc.text(String(pair[1] ?? "—"), x + colW - 8, y, { align: "right", maxWidth: colW - 90 });
      }
      y += 15;
      doc.setDrawColor(238).line(M, y - 10, PAGE_W - M, y - 10);
    }
    y += 6;
  }

  header();
  y = M + 40;

  /* 1 — cover */
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(15);
  doc.text("Property Damage Inspection Report", M, y + 10);
  y += 34;

  const coverPath = vm.coverPhoto?.storage_path;
  if (coverPath) {
    onStep?.("Placing the cover photo…");
    const url = vm.urls[coverPath] ?? (await cbPhotoSignedUrl(coverPath));
    const img = url ? await toDataUrl(url) : null;
    if (img) {
      const w = CONTENT_W;
      const h = Math.min(250, (img.h / img.w) * w);
      need(h + 8);
      doc.addImage(img.data, "JPEG", M, y, w, h, undefined, "FAST");
      y += h + 14;
    }
  }

  const job = vm.job ?? {};
  kv([
    ["Property", String(job.address ?? "—")],
    ["City / state", [job.city, job.state, job.zip].filter(Boolean).join(", ") || "—"],
    ["Homeowner", String(job.customer_name ?? "—")],
    ["Carrier", String(job.carrier ?? "—")],
    ["Claim number", String(job.claim_number ?? "—")],
    ["Date of loss", String(job.date_of_loss ?? "—")],
    ["Inspection date", String(job.inspection_date ?? "—")],
    ["Inspecting rep", vm.repName ?? "—"],
    ["Contractor", String(company?.legal_name || company?.name || "—")],
    ["License", licenses.join(", ") || "—"],
  ]);

  /* 2 — summary */
  h1("Summary of findings");
  para(vm.narrative.summary);

  /* 3 — profile */
  h1("Property and roof profile");
  const m = (k: string) => Number(vm.measurement?.[k] ?? 0) || 0;
  kv([
    ["Roof type", String(vm.sheet.roof_system.roof_type ?? "—")],
    ["Total squares", m("total_squares").toFixed(1)],
    ["Stories", String(vm.sheet.roof_system.stories ?? "—")],
    ["Roof area", `${m("total_area_sqft").toLocaleString()} SF`],
    ["Pitch", String(vm.sheet.roof_system.pitch ?? vm.measurement?.pitch ?? "—")],
    ["Ridge / hip", `${m("ridge_lf")} / ${m("hip_lf")} LF`],
    ["Layers", String(vm.sheet.roof_system.layers ?? "—")],
    ["Valley", `${m("valley_lf")} LF`],
    ["Decking", String(vm.sheet.roof_system.decking_type ?? "—")],
    ["Eave / rake", `${m("eave_lf")} / ${m("rake_lf")} LF`],
    ["Decking condition", String(vm.sheet.roof_system.decking_condition ?? "—")],
    ["Measurement source", vm.measurementSource ?? "—"],
  ]);
  para(vm.narrative.profile_note ?? "");

  /* 4 / 5 / 6 — findings */
  h1("Roof findings by elevation");
  for (const e of CB_ELEVATIONS) {
    const st = vm.elevations[e];
    if (!st) continue;
    const hits = (st.testSquares ?? []).reduce((a, t) => a + (t.hits ?? 0), 0);
    const items = Object.entries(st.roofItems ?? {});
    if (!hits && items.length === 0 && !st.slopeWide && !st.done) continue;
    h2(`${CB_ELEVATION_LABEL[e]} elevation`);
    para(
      items.length || hits
        ? `${hits} identified impact${hits === 1 ? "" : "s"} in the chalked test square. ${items
            .map(([k, v]) => `${k.replace(/_/g, " ")}${v.qty ? ` (${v.qty})` : ""}`)
            .join(", ")}`
        : "Inspected — no damage observed.",
      9.5,
    );
  }
  para(vm.narrative.roof_note ?? "");

  h1("Exterior findings by elevation");
  for (const e of CB_ELEVATIONS) {
    const st = vm.elevations[e];
    const items = Object.entries(st?.items ?? {});
    if (!st) continue;
    h2(`${CB_ELEVATION_LABEL[e]} elevation`);
    if (items.length === 0) para("Inspected — no damage observed.", 9.5);
    for (const [k, v] of items) {
      para(`• ${k.replace(/_/g, " ")}${v.qty ? ` — qty ${v.qty}` : ""}${v.note ? ` — ${v.note}` : ""}`, 9.5);
    }
  }
  para(vm.narrative.exterior_note ?? "");

  if (vm.rooms.length) {
    h1("Interior findings");
    for (const r of vm.rooms) {
      h2(`${r.name}${r.moisture != null ? ` — ${r.moisture}% moisture` : ""}`);
      for (const [k, v] of Object.entries(r.items ?? {})) {
        para(`• ${k.replace(/_/g, " ")}${v.qty ? ` — ${v.qty}` : ""}${v.note ? ` — ${v.note}` : ""}`, 9.5);
      }
      if (r.note) para(r.note, 9.5);
    }
    para(vm.narrative.interior_note ?? "");
  }

  /* 7 — scope */
  onStep?.("Writing the scope of work…");
  h1("Recommended scope of work");
  para("Quantities only — no pricing is included in this report unless a priced estimate is attached to the job.", 9);
  need(20);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(110);
  doc.text("#", M, y);
  doc.text("DESCRIPTION", M + 22, y);
  doc.text("QTY", PAGE_W - M - 70, y, { align: "right" });
  doc.text("UNIT", PAGE_W - M, y, { align: "right" });
  y += 6;
  doc.setDrawColor(200).line(M, y, PAGE_W - M, y);
  y += 12;
  vm.lineItems.forEach((it, i) => {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(35);
    const lines = doc.splitTextToSize(it.description, CONTENT_W - 130) as string[];
    const blockH = lines.length * 12 + (it.note ? 11 : 0) + 6;
    need(blockH);
    doc.text(String(i + 1), M, y);
    lines.forEach((line, li) => doc.text(line, M + 22, y + li * 12));
    doc.text(it.quantity.toLocaleString(), PAGE_W - M - 70, y, { align: "right" });
    doc.text(it.unit, PAGE_W - M, y, { align: "right" });
    y += lines.length * 12;
    if (it.note) {
      doc.setFontSize(8.5).setTextColor(120);
      doc.text(doc.splitTextToSize(it.note, CONTENT_W - 130)[0] as string, M + 22, y);
      y += 11;
    }
    y += 4;
    doc.setDrawColor(240).line(M, y - 4, PAGE_W - M, y - 4);
  });
  y += 8;
  para(vm.narrative.scope_note ?? "");

  /* 8 — ventilation */
  h1("Ventilation analysis");
  kv([
    ["Attic area (approx.)", `${vm.vent.atticSqft.toLocaleString()} SF`],
    ["Provided NFA", `${vm.vent.providedNfa.toLocaleString()} sq in`],
    ["Required NFA (1/150)", `${vm.vent.requiredNfa.toLocaleString()} sq in`],
    ["Intake / exhaust", `${vm.vent.intakeNfa} / ${vm.vent.exhaustNfa} sq in`],
  ]);
  para(
    vm.vent.under
      ? `Existing ventilation is below code-required NFA for this attic area — a deficit of ${vm.vent.deficit.toLocaleString()} sq in. ${vm.vent.recommendation ?? ""}`
      : "Existing ventilation meets the code-required net free area for this attic area.",
  );

  /* 9 — appendix */
  onStep?.("Building the photo appendix…");
  doc.addPage();
  page += 1;
  header();
  y = M + 40;
  h1("Photo appendix");

  const byCat: Record<string, CbReportPhoto[]> = {};
  for (const p of vm.photos) (byCat[p.category ?? "other"] ??= []).push(p);

  const COLS = 3;
  const GAP = 12;
  const cellW = (CONTENT_W - GAP * (COLS - 1)) / COLS;
  const cellH = cellW * 0.75;
  const blockH = cellH + 26;

  for (const [cat, list] of Object.entries(byCat)) {
    const groups: [string, CbReportPhoto[]][] = [];
    const withElev = CB_ELEVATIONS.filter((e) => list.some((p) => p.elevation === e));
    if (withElev.length) {
      for (const e of withElev) groups.push([`${CB_PHOTO_CATEGORY_LABEL[cat] ?? cat} — ${CB_ELEVATION_LABEL[e]}`, list.filter((p) => p.elevation === e)]);
      const rest = list.filter((p) => !CB_ELEVATIONS.includes(p.elevation as never));
      if (rest.length) groups.push([`${CB_PHOTO_CATEGORY_LABEL[cat] ?? cat} — other`, rest]);
    } else {
      groups.push([CB_PHOTO_CATEGORY_LABEL[cat] ?? cat, list]);
    }

    for (const [title, photos] of groups) {
      h2(title);
      for (let i = 0; i < photos.length; i += COLS) {
        need(blockH);
        const rowTop = y;
        for (let c = 0; c < COLS; c++) {
          const p = photos[i + c];
          if (!p) continue;
          const path = p.thumb_path ?? p.storage_path;
          const url = vm.urls[path] ?? (await cbPhotoSignedUrl(path));
          const img = url ? await toDataUrl(url) : null;
          const x = M + c * (cellW + GAP);
          if (img) {
            doc.addImage(img.data, "JPEG", x, rowTop, cellW, cellH, undefined, "FAST");
          } else {
            doc.setDrawColor(225).rect(x, rowTop, cellW, cellH);
          }
          doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(115);
          const caption = p.caption || [p.shot_type, p.item_key].filter(Boolean).join(" · ") || "—";
          doc.text((doc.splitTextToSize(caption, cellW) as string[]).slice(0, 2), x, rowTop + cellH + 9);
        }
        y = rowTop + blockH;
      }
    }
  }

  /* 10 — statement */
  h1("Statement and signature");
  para(vm.narrative.statement, 9.5);
  need(70);
  doc.setDrawColor(120);
  doc.line(M, y + 30, M + 220, y + 30);
  doc.line(PAGE_W - M - 220, y + 30, PAGE_W - M, y + 30);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(120);
  doc.text(`${vm.repName ?? "Inspecting representative"} — inspecting representative`, M, y + 42);
  doc.text(String(company?.legal_name || company?.name || ""), PAGE_W - M - 220, y + 42);
  footer();

  return doc.output("blob");
}

/** Render, upload to cb-documents and stamp cb_reports.pdf_path. */
export async function renderAndStoreReportPdf(args: {
  vm: CbReportViewModel;
  reportId: string;
  workspaceId: string;
  jobId: string;
  version: number;
  onStep?: CbPdfProgress;
}): Promise<string> {
  const { vm, reportId, workspaceId, jobId, version, onStep } = args;
  const blob = await renderReportPdf(vm, onStep);
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
