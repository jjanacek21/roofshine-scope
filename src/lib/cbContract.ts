/**
 * Claim Buddy agreements.
 *
 * Two documents share one structure:
 *   contingency — signed before the claim is filed, contingent on the carrier
 *                 approving the loss.
 *   retail      — no claim involved; the homeowner is paying.
 *
 * The clause set is HARDCODED. Reps cannot edit it, and the only thing that
 * varies is the state-required rescission language, which is selected from
 * cb_jobs.state through src/lib/state-contract-law.ts.
 */
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { legalForState } from "@/lib/state-contract-law";
import { CB_DOC_BUCKET } from "@/lib/cbPdf";

export type CbDocType = "contingency" | "retail";

export const CB_DOC_TYPE_LABEL: Record<CbDocType, string> = {
  contingency: "Insurance contingency agreement",
  retail: "Retail repair agreement",
};

export interface CbContractParty {
  companyName: string;
  companyLegalName: string;
  companyAddress: string;
  companyPhone: string | null;
  companyEmail: string | null;
  licenses: string[];
}

export interface CbContractScopeLine {
  description: string;
  quantity: number;
  unit: string;
}

export interface CbContractData {
  docType: CbDocType;
  homeownerName: string;
  homeownerEmail: string;
  propertyAddress: string;
  state: string;
  carrier: string | null;
  claimNumber: string | null;
  dateOfLoss: string | null;
  deductible: number | null;
  scope: CbContractScopeLine[];
  repName: string;
  party: CbContractParty;
}

export interface CbClause {
  title: string;
  body: string;
}

export function licenseListFromJson(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : ((v as Record<string, unknown>)?.number as string) || ""))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function rescissionDays(state?: string | null): number {
  return legalForState(state).rescissionDays;
}

/** The clauses every agreement carries. Not user-editable, by design. */
export function requiredClauses(docType: CbDocType, state?: string | null): CbClause[] {
  const legal = legalForState(state);
  const clauses: CbClause[] = [];

  if (docType === "contingency") {
    clauses.push({
      title: "1. Your deductible",
      body:
        "The homeowner is solely responsible for payment of the full insurance deductible stated in the carrier's " +
        "settlement. The deductible cannot be waived, rebated, discounted, absorbed, credited or paid in any part by " +
        "the contractor, and no allowance, upgrade or rebate will be offered in place of it. Any agreement to do " +
        "otherwise is insurance fraud.",
    });
    clauses.push({
      title: "2. The contractor is not a public adjuster",
      body:
        "The contractor is a licensed roofing and construction contractor. The contractor is not a public adjuster, " +
        "does not adjust, negotiate or settle the claim on the homeowner's behalf, and does not provide legal advice " +
        "about the policy. The contractor may meet the carrier's representative on site and present documentation of " +
        "the observed conditions and the scope required to repair them.",
    });
    clauses.push({
      title: "3. Signing does not guarantee approval",
      body:
        "Signing this agreement does not guarantee that the insurance claim will be approved, in whole or in part. " +
        "The carrier alone decides coverage. If the carrier denies the claim, this agreement may be cancelled under " +
        "the cancellation terms below at no cost to the homeowner.",
    });
    clauses.push({
      title: `4. Right to cancel — ${legal.name}`,
      body: `${legal.contingencyClause}\n\n${
        legal.rescissionDays
      } business day right of rescission applies from the date signed below.`,
    });
    clauses.push({
      title: "5. Scope and price follow the carrier's approved estimate",
      body:
        "The scope of work and the final contract price are subject to the carrier's approved estimate, including any " +
        "supplements approved during the course of the work. The contractor will perform the approved scope for the " +
        "approved amount plus the deductible and any upgrades the homeowner authorizes in writing. No work begins " +
        "until the claim is approved and this agreement becomes binding.",
    });
    return clauses;
  }

  clauses.push({
    title: "1. No insurance claim",
    body:
      "This is a retail agreement. No insurance claim is being filed through the contractor for this work, and the " +
      "homeowner is responsible for the full contract price. If the homeowner later files a claim for this loss, the " +
      "parties will replace this agreement with an insurance contingency agreement.",
  });
  clauses.push({
    title: "2. The contractor is not a public adjuster",
    body:
      "The contractor is a licensed roofing and construction contractor, is not a public adjuster and does not " +
      "negotiate insurance claims on the homeowner's behalf.",
  });
  clauses.push({
    title: `3. Right to cancel — ${legal.name}`,
    body: legal.contractClause,
  });
  clauses.push({
    title: "4. Scope and price",
    body:
      "The scope of work is the scope listed in this agreement. Any change to that scope, including concealed damage " +
      "discovered after work begins, is priced in a written change order signed by both parties before the additional " +
      "work is performed.",
  });
  return clauses;
}

export function contractIntro(data: CbContractData): string {
  if (data.docType === "contingency") {
    return (
      `This Insurance Contingency Agreement is entered into between ${data.party.companyLegalName} ("Contractor") and ` +
      `${data.homeownerName || "the homeowner"} ("Homeowner") for the property at ${data.propertyAddress}. ` +
      `The Homeowner authorizes the Contractor to inspect the property, document the loss and perform the repairs ` +
      `approved by the Homeowner's insurance carrier. This agreement becomes binding only when the carrier approves ` +
      `the claim, in whole or in part.`
    );
  }
  return (
    `This Retail Repair Agreement is entered into between ${data.party.companyLegalName} ("Contractor") and ` +
    `${data.homeownerName || "the homeowner"} ("Homeowner") for the property at ${data.propertyAddress}. ` +
    `The Contractor will perform the scope of work described below for the price agreed in writing by the parties.`
  );
}

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function longDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

/** Stored on cb_contracts.body_html — the exact words the homeowner agreed to. */
export function contractBodyHtml(data: CbContractData): string {
  const clauses = requiredClauses(data.docType, data.state);
  const facts: [string, string][] = [
    ["Homeowner", data.homeownerName || "—"],
    ["Property", data.propertyAddress || "—"],
    ["Contractor", data.party.companyLegalName],
    ["Representative", data.repName || "—"],
  ];
  if (data.docType === "contingency") {
    facts.push(
      ["Carrier", data.carrier || "—"],
      ["Claim number", data.claimNumber || "—"],
      ["Date of loss", longDate(data.dateOfLoss)],
      ["Deductible", data.deductible != null ? money(Number(data.deductible)) : "—"],
    );
  }
  return `
<article>
  <h1>${esc(CB_DOC_TYPE_LABEL[data.docType])}</h1>
  <p>${esc(contractIntro(data))}</p>
  <table>${facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
  <h2>Scope of work</h2>
  <ul>${
    data.scope.length
      ? data.scope
          .map((l) => `<li>${esc(l.description)} — ${l.quantity.toLocaleString()} ${esc(l.unit)}</li>`)
          .join("")
      : "<li>Scope to be set by the approved estimate.</li>"
  }</ul>
  ${clauses.map((c) => `<h2>${esc(c.title)}</h2><p>${esc(c.body).replace(/\n/g, "<br/>")}</p>`).join("")}
</article>`.trim();
}

/* ----------------------------- PDF ----------------------------- */

const PAGE_W = 612;
const PAGE_H = 792;
const M = 48;
const CONTENT_W = PAGE_W - M * 2;

export interface CbSignatureBlock {
  signerName: string;
  signerEmail: string;
  signaturePng: string | null;
  signedAt: string;
  ip?: string | null;
  userAgent?: string | null;
}

/** Countersigned PDF: the agreement, the homeowner signature and the company line. */
export function renderContractPdf(data: CbContractData, sig: CbSignatureBlock): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const licenses = data.party.licenses;
  let page = 1;
  let y = M;

  const footer = () => {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    const left = [data.party.companyLegalName, licenses.length ? `License ${licenses.join(", ")}` : null]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(left, M, PAGE_H - 30);
    doc.text(`Page ${page}`, PAGE_W - M, PAGE_H - 30, { align: "right" });
  };

  const newPage = () => {
    footer();
    doc.addPage();
    page += 1;
    y = M;
  };

  const need = (h: number) => {
    if (y + h > PAGE_H - 60) newPage();
  };

  const para = (text: string, size = 9.5, color = 60, gap = 10) => {
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(color);
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    for (const line of lines) {
      need(size + 4);
      doc.text(line, M, y);
      y += size + 3.5;
    }
    y += gap;
  };

  const heading = (text: string, size = 11) => {
    need(size + 18);
    doc.setFont("helvetica", "bold").setFontSize(size).setTextColor(20);
    doc.text(text, M, y);
    y += size + 6;
  };

  /* Title block */
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(15);
  doc.text(CB_DOC_TYPE_LABEL[data.docType].toUpperCase(), M, y);
  y += 20;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(90);
  doc.text(data.party.companyLegalName, M, y);
  y += 12;
  const contact = [data.party.companyAddress, data.party.companyPhone, data.party.companyEmail].filter(Boolean).join("  ·  ");
  if (contact) {
    doc.text(contact, M, y);
    y += 12;
  }
  if (licenses.length) {
    doc.text(`License ${licenses.join(", ")}`, M, y);
    y += 12;
  }
  doc.setDrawColor(220).line(M, y + 2, PAGE_W - M, y + 2);
  y += 18;

  para(contractIntro(data), 9.5, 55, 12);

  /* Facts */
  heading("The parties and the property");
  const rows: [string, string][] = [
    ["Homeowner", data.homeownerName || "—"],
    ["Property", data.propertyAddress || "—"],
    ["Representative", data.repName || "—"],
  ];
  if (data.docType === "contingency") {
    rows.push(
      ["Carrier", data.carrier || "—"],
      ["Claim number", data.claimNumber || "—"],
      ["Date of loss", longDate(data.dateOfLoss)],
      ["Deductible", data.deductible != null ? money(Number(data.deductible)) : "—"],
    );
  }
  for (const [k, v] of rows) {
    need(15);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(110);
    doc.text(k, M, y);
    doc.setFont("helvetica", "normal").setTextColor(35);
    const lines = doc.splitTextToSize(v, CONTENT_W - 120) as string[];
    doc.text(lines, M + 120, y);
    y += Math.max(14, lines.length * 12);
  }
  y += 10;

  /* Scope */
  heading("Scope of work");
  if (!data.scope.length) {
    para("Scope to be set by the carrier's approved estimate.", 9.5, 55, 8);
  } else {
    for (const line of data.scope) {
      need(14);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(45);
      const desc = doc.splitTextToSize(line.description, CONTENT_W - 110) as string[];
      doc.text(desc, M, y);
      doc.text(`${line.quantity.toLocaleString()} ${line.unit}`, PAGE_W - M, y, { align: "right" });
      y += Math.max(13, desc.length * 11.5);
    }
    y += 12;
  }

  /* Clauses */
  for (const clause of requiredClauses(data.docType, data.state)) {
    heading(clause.title, 10.5);
    para(clause.body, 9.5, 55, 10);
  }

  /* Signatures */
  need(150);
  heading("Signatures");
  const colW = (CONTENT_W - 30) / 2;
  const sigTop = y + 6;
  if (sig.signaturePng) {
    try {
      doc.addImage(sig.signaturePng, "PNG", M, sigTop, colW, 46, undefined, "FAST");
    } catch {
      /* a missing image must never block the document */
    }
  }
  doc.setDrawColor(160);
  doc.line(M, sigTop + 52, M + colW, sigTop + 52);
  doc.line(M + colW + 30, sigTop + 52, M + colW + 30 + colW, sigTop + 52);

  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(25);
  doc.text(sig.signerName || "Homeowner", M, sigTop + 66);
  doc.text(data.repName || data.party.companyName, M + colW + 30, sigTop + 66);

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
  doc.text(`Homeowner · ${longDate(sig.signedAt)}`, M, sigTop + 78);
  doc.text(`${data.party.companyLegalName} · ${longDate(sig.signedAt)}`, M + colW + 30, sigTop + 78);
  if (sig.signerEmail) doc.text(sig.signerEmail, M, sigTop + 90);

  y = sigTop + 108;
  need(40);
  doc.setFontSize(7.5).setTextColor(140);
  const audit = [
    `Signed electronically ${new Date(sig.signedAt).toLocaleString()}`,
    sig.ip ? `IP ${sig.ip}` : null,
    sig.userAgent ? `Device ${sig.userAgent.slice(0, 90)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  for (const line of doc.splitTextToSize(audit, CONTENT_W) as string[]) {
    doc.text(line, M, y);
    y += 10;
  }

  footer();
  return doc.output("blob");
}

/** Render, upload to cb-documents and stamp cb_contracts.pdf_path. */
export async function renderAndStoreContractPdf(args: {
  data: CbContractData;
  sig: CbSignatureBlock;
  contractId: string;
  workspaceId: string;
  jobId: string;
}): Promise<string> {
  const blob = renderContractPdf(args.data, args.sig);
  const path = `${args.workspaceId}/${args.jobId}/contract.pdf`;
  const { error } = await supabase.storage
    .from(CB_DOC_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  await supabase.from("cb_contracts").update({ pdf_path: path }).eq("id", args.contractId);
  return path;
}
