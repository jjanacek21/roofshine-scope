/**
 * Claim Buddy estimate PDF — same letterhead, margins and footer as the
 * damage report so the two documents read as one package.
 */
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { cbLogoSignedUrl } from "@/lib/cbLogo";
import { CB_DOC_BUCKET } from "@/lib/cbPdf";
import {
  computeTotals,
  perSquareMath,
  type CbDraftLine,
  type CbEstimateMode,
  type CbEstimatePercents,
} from "@/lib/cbEstimate";

const PAGE_W = 612;
const PAGE_H = 792;
const M = 36;
const CONTENT_W = PAGE_W - M * 2;
const FOOTER_TOP = PAGE_H - 46;

const money = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const qtyFmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

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

export interface CbEstimatePdfArgs {
  mode: CbEstimateMode;
  lines: CbDraftLine[];
  percents: CbEstimatePercents;
  pricePerSquare: number;
  measurement: Record<string, unknown> | null;
  company: {
    name?: string | null;
    legal_name?: string | null;
    logo_path?: string | null;
    phone?: string | null;
    email?: string | null;
    license_numbers?: unknown;
  } | null;
  property: { customer?: string | null; address?: string | null; claim?: string | null };
  bookName?: string | null;
}

export async function renderCbEstimatePdf(args: CbEstimatePdfArgs): Promise<Blob> {
  const { mode, lines, percents, pricePerSquare, measurement, company, property } = args;
  const perSquare = mode === "per_square";
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });

  const logoUrl = await cbLogoSignedUrl(company?.logo_path);
  const logo = logoUrl ? await toDataUrl(logoUrl) : null;
  const licenses = Array.isArray(company?.license_numbers)
    ? (company!.license_numbers as string[]).filter(Boolean)
    : [];
  const footerText = [company?.legal_name || company?.name, licenses.length ? `License ${licenses.join(", ")}` : null]
    .filter(Boolean)
    .join("  ·  ");

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
    doc.text(perSquare ? "Repair Proposal" : "Estimate", PAGE_W - M, M + 4, { align: "right" });
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

  header();
  y = M + 40;
  h1(perSquare ? "Repair Proposal" : "Estimate of Repair");

  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(50);
  const facts: [string, string][] = [
    ["Customer", property.customer || "—"],
    ["Property", property.address || "—"],
    ["Claim #", property.claim || "—"],
    ["Date", new Date().toLocaleDateString()],
  ];
  for (const [k, v] of facts) {
    need(15);
    doc.setTextColor(120).text(k, M, y);
    doc.setTextColor(30).text(v, M + 90, y);
    y += 15;
  }
  y += 10;

  if (perSquare) {
    const math = perSquareMath(measurement, pricePerSquare);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
    for (const line of doc.splitTextToSize(math.sentence, CONTENT_W) as string[]) {
      need(15);
      doc.text(line, M, y);
      y += 15;
    }
    y += 6;
    need(50);
    doc.setFillColor(244, 246, 245).rect(M, y - 4, CONTENT_W, 40, "F");
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20);
    doc.text(money(math.total), PAGE_W - M - 8, y + 22, { align: "right" });
    doc.setFontSize(11).text("Total", M + 8, y + 22);
    y += 56;
    h1("What is included");
    for (const l of lines) {
      need(15);
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(45);
      doc.text(`•  ${l.name}`, M, y);
      y += 15;
    }
  } else {
    /* table */
    const cols = { code: M, name: M + 60, qty: M + 330, unit: M + 385, price: M + 440, total: PAGE_W - M };
    function tableHead() {
      need(20);
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(110);
      doc.text("CODE", cols.code, y);
      doc.text("DESCRIPTION", cols.name, y);
      doc.text("QTY", cols.qty, y, { align: "right" });
      doc.text("UNIT", cols.unit, y);
      doc.text("PRICE", cols.price, y, { align: "right" });
      doc.text("TOTAL", cols.total, y, { align: "right" });
      y += 6;
      doc.setDrawColor(210).line(M, y, PAGE_W - M, y);
      y += 12;
    }
    tableHead();
    lines.forEach((l, i) => {
      const nameLines = doc.splitTextToSize(l.name, 258) as string[];
      const h = Math.max(14, nameLines.length * 11 + 4);
      if (y + h > FOOTER_TOP - 60) {
        newPage();
        tableHead();
      }
      if (i % 2 === 1) doc.setFillColor(248, 249, 249).rect(M, y - 9, CONTENT_W, h, "F");
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(120);
      doc.text(l.code ?? "—", cols.code, y);
      doc.setFontSize(9).setTextColor(30);
      nameLines.forEach((t, k) => doc.text(t, cols.name, y + k * 11));
      doc.text(qtyFmt(l.qty), cols.qty, y, { align: "right" });
      doc.setTextColor(110).text(l.unit, cols.unit, y);
      doc.setTextColor(30).text(money(l.unit_price), cols.price, y, { align: "right" });
      doc.setFont("helvetica", "bold").text(money(l.qty * l.unit_price), cols.total, y, { align: "right" });
      y += h;
    });

    const totals = computeTotals(lines, percents);
    y += 8;
    need(110);
    doc.setDrawColor(210).line(PAGE_W - M - 220, y, PAGE_W - M, y);
    y += 16;
    const rows: [string, number][] = [
      ["Subtotal", totals.subtotal],
      ["Markup", totals.markup],
      ["Overhead", totals.overhead],
      ["Profit", totals.profit],
      ["Sales tax", totals.tax],
    ];
    for (const [label, value] of rows) {
      if (value === 0 && label !== "Subtotal") continue;
      doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(90);
      doc.text(label, PAGE_W - M - 220, y);
      doc.setTextColor(30).text(money(value), PAGE_W - M, y, { align: "right" });
      y += 15;
    }
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(20);
    doc.text("Total", PAGE_W - M - 220, y + 4);
    doc.text(money(totals.total), PAGE_W - M, y + 4, { align: "right" });
    y += 26;
  }

  footer();
  return doc.output("blob");
}

/** Render, upload to cb-documents and return the storage path. */
export async function renderAndStoreCbEstimatePdf(args: {
  pdf: CbEstimatePdfArgs;
  workspaceId: string;
  jobId: string;
}): Promise<string> {
  const blob = await renderCbEstimatePdf(args.pdf);
  const path = `${args.workspaceId}/${args.jobId}/estimate.pdf`;
  const { error } = await supabase.storage
    .from(CB_DOC_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  return path;
}
