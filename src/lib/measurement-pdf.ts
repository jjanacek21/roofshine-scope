import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { fileJobDocument } from "@/lib/jobDocuments";

/**
 * A measurement, as a page the office can hand over.
 *
 * A saved measurement was only ever a row and a green banner. Nothing was
 * produced that could be filed, so the Documents tab never listed it and a
 * permit packet had no diagram page to include — `job_documents.storage_path`
 * is NOT NULL, and there was no file to point it at.
 *
 * This draws the page as vector text rather than rasterising a screen. It is a
 * sheet of numbers, so real text keeps it sharp at any zoom, keeps the file
 * small, and lets a plans examiner select and search the figures.
 */

export interface MeasurementRow {
  id?: string | null;
  total_area_sqft?: number | null;
  squares?: number | null;
  waste_pct?: number | null;
  predominant_pitch?: string | null;
  eaves_lf?: number | null;
  rakes_lf?: number | null;
  ridges_lf?: number | null;
  hips_lf?: number | null;
  valleys_lf?: number | null;
  gutters_lf?: number | null;
  drip_edge_lf?: number | null;
  step_flashing_lf?: number | null;
  wall_flashing_lf?: number | null;
  parapet_wall_lf?: number | null;
  transition_lf?: number | null;
  source?: string | null;
  source_file_url?: string | null;
  notes?: string | null;
  verified_at?: string | null;
  updated_at?: string | null;
}

export const MEASUREMENT_SOURCE_LABEL: Record<string, string> = {
  mapbox_draw: "Traced from satellite imagery",
  google_solar: "Google Solar building model",
  claim_buddy: "Claim Buddy roof editor",
  manual: "Entered by hand",
  eagleview: "EagleView report",
  roofr: "Roofr report",
  hover: "Hover report",
};

/** Line items in the order a roofer reads them, not database order. */
const LINES: { key: keyof MeasurementRow; label: string }[] = [
  { key: "eaves_lf", label: "Eaves" },
  { key: "rakes_lf", label: "Rakes" },
  { key: "ridges_lf", label: "Ridges" },
  { key: "hips_lf", label: "Hips" },
  { key: "valleys_lf", label: "Valleys" },
  { key: "drip_edge_lf", label: "Drip edge" },
  { key: "gutters_lf", label: "Gutters" },
  { key: "step_flashing_lf", label: "Step flashing" },
  { key: "wall_flashing_lf", label: "Wall flashing" },
  { key: "parapet_wall_lf", label: "Parapet wall" },
  { key: "transition_lf", label: "Transitions" },
];

const num = (v: unknown, dp = 0) =>
  Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export interface MeasurementPdfInput {
  measurement: MeasurementRow;
  jobId: string;
  companyId: string;
  companyName?: string | null;
  jobLabel?: string | null;
  customerName?: string | null;
  propertyAddress?: string | null;
}

export function buildMeasurementPdf(input: MeasurementPdfInput): Blob {
  const m = input.measurement;
  const pdf = new jsPDF("p", "pt", "letter");
  const W = pdf.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  const rule = (thickness = 0.7, color = 170) => {
    pdf.setDrawColor(color);
    pdf.setLineWidth(thickness);
    pdf.line(M, y, W - M, y);
  };

  // ---- masthead -----------------------------------------------------------
  pdf.setFont("helvetica", "bold").setFontSize(16).setTextColor(20);
  pdf.text(input.companyName || "Roof Measurement", M, y);
  pdf.setFont("helvetica", "bold").setFontSize(19);
  pdf.text("ROOF MEASUREMENT", W - M, y, { align: "right" });
  y += 10;
  rule(1.4, 40);
  y += 22;

  // ---- who and where ------------------------------------------------------
  const facts: [string, string][] = [
    ["Job", input.jobLabel || "—"],
    ["Customer", input.customerName || "—"],
    ["Property", input.propertyAddress || "—"],
    ["Measured", new Date(m.updated_at ?? Date.now()).toLocaleDateString()],
  ];
  const colW = (W - M * 2) / 2;
  facts.forEach(([k, v], i) => {
    const x = M + (i % 2) * colW;
    const row = Math.floor(i / 2);
    pdf.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(120);
    pdf.text(k.toUpperCase(), x, y + row * 30);
    pdf.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(25);
    pdf.text(pdf.splitTextToSize(v, colW - 14)[0] ?? v, x, y + row * 30 + 13);
  });
  y += 30 * Math.ceil(facts.length / 2) + 8;
  rule();
  y += 24;

  // ---- the three numbers that matter --------------------------------------
  const squares = Number(m.squares ?? 0);
  const area = Number(m.total_area_sqft ?? 0);
  const waste = Number(m.waste_pct ?? 0);
  const headline: [string, string][] = [
    [`${num(squares, 1)}`, "SQUARES (with waste)"],
    [`${num(area)}`, "ROOF AREA SF"],
    [`${m.predominant_pitch || "—"}`, "PREDOMINANT PITCH"],
    [`${num(waste)}%`, "WASTE"],
  ];
  const hw = (W - M * 2) / 4;
  headline.forEach(([big, lab], i) => {
    const x = M + i * hw;
    pdf.setFont("helvetica", "bold").setFontSize(21).setTextColor(20);
    pdf.text(big, x, y);
    pdf.setFont("helvetica", "bold").setFontSize(7).setTextColor(120);
    pdf.text(lab, x, y + 13);
  });
  y += 34;
  rule();
  y += 26;

  // ---- linear measurements ------------------------------------------------
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(120);
  pdf.text("LINEAR MEASUREMENTS", M, y);
  y += 14;

  const present = LINES.filter((l) => Number(m[l.key] ?? 0) > 0);
  const rows = present.length ? present : LINES.slice(0, 5);
  const half = Math.ceil(rows.length / 2);
  rows.forEach((l, i) => {
    const col = i < half ? 0 : 1;
    const r = i < half ? i : i - half;
    const x = M + col * colW;
    const yy = y + r * 19;
    pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(45);
    pdf.text(l.label, x, yy);
    pdf.setFont("helvetica", "bold").setTextColor(20);
    pdf.text(`${num(m[l.key])} LF`, x + colW - 22, yy, { align: "right" });
    pdf.setDrawColor(228);
    pdf.setLineWidth(0.5);
    pdf.line(x, yy + 5.5, x + colW - 22, yy + 5.5);
  });
  y += half * 19 + 14;

  if (!present.length) {
    pdf.setFont("helvetica", "italic").setFontSize(9).setTextColor(140);
    pdf.text("No linear measurements were recorded on this roof.", M, y);
    y += 18;
  }

  // ---- provenance ---------------------------------------------------------
  rule();
  y += 20;
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(120);
  pdf.text("HOW THIS WAS MEASURED", M, y);
  y += 14;
  pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(45);
  const src = m.source ? MEASUREMENT_SOURCE_LABEL[m.source] ?? m.source : "Not recorded";
  pdf.text(src, M, y);
  y += 16;
  if (m.verified_at) {
    pdf.setTextColor(30, 110, 70);
    pdf.text(`Reviewed and verified on ${new Date(m.verified_at).toLocaleDateString()}.`, M, y);
    y += 16;
  } else {
    pdf.setFont("helvetica", "italic").setTextColor(150, 90, 20);
    pdf.text("Not yet reviewed by a person.", M, y);
    y += 16;
  }
  if (m.notes) {
    pdf.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(60);
    pdf.splitTextToSize(m.notes, W - M * 2).slice(0, 6).forEach((ln: string) => {
      pdf.text(ln, M, y);
      y += 13;
    });
  }

  // ---- footer -------------------------------------------------------------
  const bottom = pdf.internal.pageSize.getHeight() - 40;
  pdf.setDrawColor(210).setLineWidth(0.5);
  pdf.line(M, bottom - 12, W - M, bottom - 12);
  pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(140);
  pdf.text(
    "Quantities are measured from the roof geometry on file and include the waste allowance shown. " +
      "Verify in the field before ordering.",
    M,
    bottom,
    { maxWidth: W - M * 2 },
  );

  return pdf.output("blob");
}

export interface SaveMeasurementPdfResult {
  filename: string;
  storagePath: string | null;
  filed: boolean;
}

/**
 * Build it, hand it to the user, then file it on the job. The download happens
 * first and unconditionally: storage and filing are a convenience on top, and a
 * failure in either should not cost the user the document.
 */
export async function saveMeasurementPdf(input: MeasurementPdfInput): Promise<SaveMeasurementPdfResult> {
  const blob = buildMeasurementPdf(input);
  const stamp = new Date().toISOString().slice(0, 10);
  const jobPart = (input.jobLabel ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const filename = ["roof-measurement", jobPart, stamp].filter(Boolean).join("-") + ".pdf";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const storagePath = `${input.companyId}/${input.jobId}/measurements/${Date.now()}-${filename}`;
  const { error: upErr } = await supabase.storage
    .from("job-documents")
    .upload(storagePath, blob, { contentType: "application/pdf", upsert: true });

  if (upErr) {
    console.warn("measurement PDF was generated but could not be stored", upErr);
    return { filename, storagePath: null, filed: false };
  }

  const filed = await fileJobDocument({
    jobId: input.jobId,
    companyId: input.companyId,
    kind: "measurement_report",
    title: "Roof Measurement",
    bucket: "job-documents",
    storagePath,
    mimeType: "application/pdf",
    fileSize: blob.size,
    sourceTable: "roof_measurements",
    sourceId: input.measurement.id ?? null,
  });

  return { filename, storagePath, filed };
}
