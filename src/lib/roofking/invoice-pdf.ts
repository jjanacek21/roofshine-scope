import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { RKInvoice } from "./types";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

export type RKInvoicePdfCompany = {
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export function downloadRKInvoicePdf(
  invoice: RKInvoice,
  company: RKInvoicePdfCompany,
  woNumber: number | null,
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  // Header bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(company.name || "Roof King", M, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const meta = [company.phone, company.email, company.website].filter(Boolean).join("  •  ");
  if (meta) doc.text(meta, M, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("INVOICE", W - M, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`#${invoice.invoice_number}`, W - M, 60, { align: "right" });
  if (woNumber) doc.text(`WO-${woNumber}`, W - M, 74, { align: "right" });

  y = 120;
  doc.setTextColor(15, 23, 42);

  // Bill To + Dates
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("BILL TO", M, y);
  doc.text("PROPERTY", M + 230, y);
  doc.text("ISSUED", W - M - 140, y);
  doc.text("DUE", W - M, y, { align: "right" });

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(invoice.bill_to.name || "—", M, y + 16);
  doc.text(invoice.property.name || "—", M + 230, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const billLines = [
    invoice.bill_to.contact,
    invoice.bill_to.phone,
    invoice.bill_to.email,
    invoice.bill_to.address,
  ].filter(Boolean);
  billLines.forEach((l, i) => doc.text(String(l), M, y + 32 + i * 12));

  const propLines = [invoice.property.address].filter(Boolean);
  propLines.forEach((l, i) => doc.text(String(l), M + 230, y + 32 + i * 12));

  doc.text(invoice.issue_date || "—", W - M - 140, y + 32);
  doc.text(invoice.due_date || "—", W - M, y + 32, { align: "right" });

  y = y + 32 + Math.max(billLines.length, propLines.length, 1) * 12 + 20;

  // Description
  if (invoice.description) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("WORK DESCRIPTION", M, y);
    y += 14;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(invoice.description, W - M * 2);
    doc.text(wrapped, M, y);
    y += wrapped.length * 12 + 14;
  }

  // Line items
  const body = (invoice.lines || []).map((l) => [
    l.desc + (l.notes ? `\n${l.notes}` : ""),
    String(l.qty),
    money(l.price),
    money((l.qty || 0) * (l.price || 0)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Rate", "Amount"]],
    body,
    margin: { left: M, right: M },
    styles: { fontSize: 10, cellPadding: 8, lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 50, halign: "right" },
      2: { cellWidth: 80, halign: "right" },
      3: { cellWidth: 90, halign: "right" },
    },
  });

  // Totals
  const subtotal = (invoice.lines || []).reduce((s, l) => s + (l.qty || 0) * (l.price || 0), 0);
  const tax = subtotal * ((invoice.tax_pct || 0) / 100);
  const total = subtotal + tax;

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  const labelX = W - M - 120;
  const valueX = W - M;
  let ty = afterTable;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text("Subtotal", labelX, ty);
  doc.setTextColor(15, 23, 42);
  doc.text(money(subtotal), valueX, ty, { align: "right" });
  ty += 16;
  doc.setTextColor(80);
  doc.text(`Tax (${invoice.tax_pct || 0}%)`, labelX, ty);
  doc.setTextColor(15, 23, 42);
  doc.text(money(tax), valueX, ty, { align: "right" });
  ty += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, ty, valueX, ty);
  ty += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total", labelX, ty);
  doc.text(money(total), valueX, ty, { align: "right" });

  if (invoice.notes) {
    ty += 30;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("NOTES", M, ty);
    ty += 14;
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const w = doc.splitTextToSize(invoice.notes, W - M * 2);
    doc.text(w, M, ty);
  }

  doc.save(`Invoice-${invoice.invoice_number}.pdf`);
}
