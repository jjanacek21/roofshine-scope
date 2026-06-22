// Shared PDF builder for the SPF savings report. Used by the Savings page and
// the lead detail sheet's "Generate report" action so the layout stays identical.
import jsPDF from "jspdf";
import { fmtMoney, fmtNum, type LeadRow } from "@/lib/leads";
import { RK_BRAND } from "@/lib/roofking/brand";

export interface ReportInputs {
  sqft: number;
  restorePsf: number;
  replacePsf: number;
  energySavingsPctPerYear: number;
  baselineOpsPerSqftPerYear: number;
  recoatYear: number;
  recoatPsf: number;
  years: number;
  inflation: number;
}

export const TEAROFF_COSTS: Record<string, number> = {
  bur: 22, tpo: 18, epdm: 17, modified: 20, metal: 25, shingle: 16,
};
export const SPF_COSTS: Record<string, number> = {
  bur: 12, tpo: 10, epdm: 9.5, modified: 11, metal: 13, shingle: 8,
};
export function priceForRoofType(roofType: string | null | undefined): { tearoff: number; spf: number } {
  const k = (roofType ?? "").toLowerCase();
  if (k.includes("bur") || k.includes("built")) return { tearoff: TEAROFF_COSTS.bur, spf: SPF_COSTS.bur };
  if (k.includes("tpo")) return { tearoff: TEAROFF_COSTS.tpo, spf: SPF_COSTS.tpo };
  if (k.includes("epdm") || k.includes("rubber")) return { tearoff: TEAROFF_COSTS.epdm, spf: SPF_COSTS.epdm };
  if (k.includes("mod")) return { tearoff: TEAROFF_COSTS.modified, spf: SPF_COSTS.modified };
  if (k.includes("metal") || k.includes("standing") || k.includes("r-panel")) return { tearoff: TEAROFF_COSTS.metal, spf: SPF_COSTS.metal };
  if (k.includes("shingle")) return { tearoff: TEAROFF_COSTS.shingle, spf: SPF_COSTS.shingle };
  return { tearoff: TEAROFF_COSTS.modified, spf: SPF_COSTS.modified };
}

export const DEFAULT_REPORT_INPUTS: ReportInputs = {
  sqft: 30000,
  restorePsf: SPF_COSTS.modified,
  replacePsf: TEAROFF_COSTS.modified,
  energySavingsPctPerYear: 25,
  baselineOpsPerSqftPerYear: 0.45,
  recoatYear: 20,
  recoatPsf: 3.0,
  years: 20,
  inflation: 3,
};

export function defaultsForLead(lead: Pick<LeadRow, "sqft" | "roof_type"> | null | undefined): ReportInputs {
  if (!lead) return { ...DEFAULT_REPORT_INPUTS };
  const { spf, tearoff } = priceForRoofType(lead.roof_type);
  return {
    ...DEFAULT_REPORT_INPUTS,
    sqft: lead.sqft ?? DEFAULT_REPORT_INPUTS.sqft,
    restorePsf: spf,
    replacePsf: tearoff,
  };
}

export interface YearRow {
  year: number;
  restoreCum: number;
  replaceCum: number;
  savings: number;
}

export function project(inputs: ReportInputs): YearRow[] {
  const restoreUpfront = inputs.sqft * inputs.restorePsf;
  const replaceUpfront = inputs.sqft * inputs.replacePsf;
  const baselineOps = inputs.sqft * inputs.baselineOpsPerSqftPerYear;
  const energyMultiplier = 1 - inputs.energySavingsPctPerYear / 100;
  const infl = 1 + inputs.inflation / 100;

  const rows: YearRow[] = [];
  let restoreCum = restoreUpfront;
  let replaceCum = replaceUpfront;
  for (let y = 1; y <= inputs.years; y++) {
    const inflate = Math.pow(infl, y - 1);
    const replaceOps = baselineOps * inflate;
    const restoreOps = baselineOps * inflate * energyMultiplier;
    replaceCum += replaceOps;
    restoreCum += restoreOps;
    if (y === inputs.recoatYear) {
      restoreCum += inputs.sqft * inputs.recoatPsf * inflate;
    }
    rows.push({
      year: y,
      restoreCum: Math.round(restoreCum),
      replaceCum: Math.round(replaceCum),
      savings: Math.round(replaceCum - restoreCum),
    });
  }
  return rows;
}

export interface BuildReportArgs {
  inputs: ReportInputs;
  lead?: Pick<LeadRow, "address" | "city" | "state" | "zip" | "owner"> | null;
}

export function buildSavingsReportPdf({ inputs, lead }: BuildReportArgs): { doc: jsPDF; safeName: string } {
  const rows = project(inputs);
  const final = rows[rows.length - 1];
  const restoreUpfront = inputs.sqft * inputs.restorePsf;
  const replaceUpfront = inputs.sqft * inputs.replacePsf;
  const upfrontSavings = replaceUpfront - restoreUpfront;
  const totalSavings = final?.savings ?? 0;
  const roiPct = restoreUpfront > 0 ? (totalSavings / restoreUpfront) * 100 : 0;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  let y = 56;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SPF Restoration Savings Report", 56, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 56, y);
  y += 24;

  if (lead) {
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Property", 56, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(lead.address, 56, y);
    y += 14;
    doc.text(`${lead.city ?? ""}, ${lead.state ?? ""} ${lead.zip ?? ""}`, 56, y);
    y += 14;
    if (lead.owner) {
      doc.text(`Owner: ${lead.owner}`, 56, y);
      y += 14;
    }
    y += 10;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Inputs", 56, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const ipairs: [string, string][] = [
    ["Roof area", `${fmtNum(inputs.sqft)} sq ft`],
    ["Restoration cost", `${fmtMoney(inputs.restorePsf)} / sq ft`],
    ["Replacement cost", `${fmtMoney(inputs.replacePsf)} / sq ft`],
    ["Energy savings vs. replace", `${inputs.energySavingsPctPerYear}% / yr`],
    ["Baseline maintenance", `${fmtMoney(inputs.baselineOpsPerSqftPerYear)} / sqft / yr`],
    ["Re-coat at year", `${inputs.recoatYear} (${fmtMoney(inputs.recoatPsf)} / sqft)`],
    ["Horizon", `${inputs.years} years`],
    ["Inflation", `${inputs.inflation}% / yr`],
  ];
  ipairs.forEach(([k, v]) => {
    doc.text(k, 56, y);
    doc.text(v, 280, y);
    y += 14;
  });

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Headline numbers", 56, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const hpairs: [string, string][] = [
    ["Up-front savings (Day 1)", fmtMoney(upfrontSavings)],
    [`Total savings over ${inputs.years} years`, fmtMoney(totalSavings)],
    ["ROI on restoration", `${roiPct.toFixed(0)}%`],
  ];
  hpairs.forEach(([k, v]) => {
    doc.text(k, 56, y);
    doc.text(v, 280, y);
    y += 14;
  });

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Year-by-year cumulative cost", 56, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Year", 56, y);
  doc.text("Restore", 130, y);
  doc.text("Replace", 230, y);
  doc.text("Savings", 330, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  rows.forEach((r) => {
    if (y > 740) {
      doc.addPage();
      y = 56;
    }
    doc.text(String(r.year), 56, y);
    doc.text(fmtMoney(r.restoreCum), 130, y);
    doc.text(fmtMoney(r.replaceCum), 230, y);
    doc.text(fmtMoney(r.savings), 330, y);
    y += 12;
  });

  y += 20;
  if (y > 720) {
    doc.addPage();
    y = 56;
  }
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "Estimates only. Actual results depend on roof condition, climate, energy rates, and selected system.",
    56,
    y,
    { maxWidth: W - 112 },
  );

  const safeName = (lead?.address ?? "savings-report").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return { doc, safeName };
}
