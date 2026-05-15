import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { InvoicePreviewData } from "@/components/invoices/InvoicePreview";

// Convert any CSS color (hex, rgb, oklch, named) to [r,g,b] using browser canvas.
function toRgb(color: string, fallback: [number, number, number] = [15, 23, 42]): [number, number, number] {
  if (typeof document === "undefined") return fallback;
  try {
    const el = document.createElement("div");
    el.style.color = color;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = computed.match(/rgba?\(([^)]+)\)/);
    if (!m) return fallback;
    const [r, g, b] = m[1].split(",").map((v) => parseInt(v.trim(), 10));
    return [r, g, b];
  } catch {
    return fallback;
  }
}

const FONT_FOR: Record<string, "helvetica" | "times" | "courier"> = {
  "sans-serif": "helvetica",
  serif: "times",
  mono: "courier",
};

function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n || 0);
}

async function loadImage(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 200, h: 80 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(data: InvoicePreviewData): Promise<jsPDF> {
  const { invoice, lines, company, layout } = data;

  const L = {
    accent: layout?.accent || "#1e40af",
    accent_text: layout?.accent_text || "#ffffff",
    bg: layout?.bg || "#ffffff",
    text: layout?.text || "#0f172a",
    muted: layout?.muted || "#64748b",
    heading_font: (layout?.heading_font || "sans-serif") as "sans-serif" | "serif" | "mono",
    body_font: (layout?.body_font || "sans-serif") as "sans-serif" | "serif" | "mono",
    header_style: (layout?.header_style || "banner") as "banner" | "split" | "clean" | "block",
    table_style: (layout?.table_style || "lined") as "lined" | "zebra" | "borderless" | "boxed",
    logo_position: (layout?.logo_position || "left") as "left" | "right",
    show_accent_stripe: layout?.show_accent_stripe ?? true,
  };

  const accent = toRgb(L.accent, [30, 64, 175]);
  const accentText = toRgb(L.accent_text, [255, 255, 255]);
  const bg = toRgb(L.bg, [255, 255, 255]);
  const text = toRgb(L.text, [15, 23, 42]);
  const muted = toRgb(L.muted, [100, 116, 139]);
  const headingFont = FONT_FOR[L.heading_font];
  const bodyFont = FONT_FOR[L.body_font];

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;

  // Background
  if (bg[0] !== 255 || bg[1] !== 255 || bg[2] !== 255) {
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(0, 0, pageW, pageH, "F");
  }

  let y = 0;

  // Accent stripe
  if (L.show_accent_stripe) {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 0, pageW, 6, "F");
    y = 6;
  }

  // Header
  const headerHasBg = L.header_style === "banner" || L.header_style === "block";
  const headerH = L.header_style === "block" ? 110 : 90;
  if (headerHasBg) {
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, y, pageW, headerH, "F");
  }

  const headerTextColor = headerHasBg ? accentText : text;
  const logoOnRight = L.logo_position === "right";
  const leftX = logoOnRight ? pageW - M : M;
  const rightX = logoOnRight ? M : pageW - M;
  const leftAlign: "left" | "right" = logoOnRight ? "right" : "left";
  const rightAlign: "left" | "right" = logoOnRight ? "left" : "right";

  let leftCursorY = y + 32;

  // Logo or company name (left side)
  let logo: { dataUrl: string; w: number; h: number } | null = null;
  if (company?.logo_url) {
    logo = await loadImage(company.logo_url);
  }
  if (logo) {
    const maxH = 48;
    const ratio = logo.w / logo.h;
    const h = Math.min(maxH, logo.h);
    const w = h * ratio;
    const lx = logoOnRight ? pageW - M - w : M;
    try {
      doc.addImage(logo.dataUrl, "PNG", lx, leftCursorY - 16, w, h);
    } catch {
      // ignore
    }
    leftCursorY += h + 4;
  } else {
    doc.setFont(headingFont, "bold");
    doc.setFontSize(18);
    doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
    doc.text(company?.name || "Your Company", leftX, leftCursorY, { align: leftAlign });
    leftCursorY += 18;
  }

  doc.setFont(bodyFont, "normal");
  doc.setFontSize(9);
  doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
  for (const line of [company?.address, company?.phone, company?.email, company?.website].filter(Boolean) as string[]) {
    for (const ln of line.split("\n")) {
      doc.text(ln, leftX, leftCursorY, { align: leftAlign });
      leftCursorY += 11;
    }
  }

  // INVOICE title (right side of header)
  doc.setFont(headingFont, "bold");
  doc.setFontSize(28);
  doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
  doc.text("INVOICE", rightX, y + 38, { align: rightAlign });
  doc.setFont(bodyFont, "normal");
  doc.setFontSize(10);
  doc.text(invoice.invoice_number, rightX, y + 54, { align: rightAlign });

  y = Math.max(y + headerH, leftCursorY) + 24;

  // Bill to + dates
  doc.setFont(bodyFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("BILL TO", M, y);

  doc.setFont(bodyFont, "bold");
  doc.setFontSize(11);
  doc.setTextColor(text[0], text[1], text[2]);
  doc.text(invoice.customer_name || "—", M, y + 14);

  doc.setFont(bodyFont, "normal");
  doc.setFontSize(9);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  let billY = y + 26;
  for (const v of [invoice.customer_address, invoice.customer_email, invoice.customer_phone].filter(Boolean) as string[]) {
    for (const ln of v.split("\n")) {
      doc.text(ln, M, billY);
      billY += 11;
    }
  }

  // Dates (right)
  doc.setFontSize(9);
  doc.setTextColor(muted[0], muted[1], muted[2]);
  doc.text("Issue Date", pageW - M - 90, y);
  doc.setTextColor(text[0], text[1], text[2]);
  doc.setFont(bodyFont, "bold");
  doc.text(format(new Date(invoice.issue_date), "MMM d, yyyy"), pageW - M, y, { align: "right" });
  if (invoice.due_date) {
    doc.setFont(bodyFont, "normal");
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text("Due Date", pageW - M - 90, y + 14);
    doc.setTextColor(text[0], text[1], text[2]);
    doc.setFont(bodyFont, "bold");
    doc.text(format(new Date(invoice.due_date), "MMM d, yyyy"), pageW - M, y + 14, { align: "right" });
  }

  y = Math.max(billY, y + 30) + 16;

  // Line items table
  const currency = invoice.currency || "USD";
  const body = lines.length
    ? lines.map((l) => [
        l.description ? `${l.name}\n${l.description}` : l.name,
        `${l.qty}${l.unit ? " " + l.unit : ""}`,
        money(l.unit_price, currency),
        money(l.total ?? l.qty * l.unit_price, currency),
      ])
    : [["No line items", "", "", ""]];

  const tableStyle = L.table_style;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Description", "Qty", "Price", "Total"]],
    body,
    theme: tableStyle === "boxed" ? "grid" : tableStyle === "borderless" ? "plain" : "striped",
    styles: {
      font: bodyFont,
      fontSize: 10,
      textColor: text,
      cellPadding: 6,
    },
    headStyles: {
      font: bodyFont,
      fontStyle: "bold",
      fontSize: 9,
      fillColor: tableStyle === "boxed" ? accent : [255, 255, 255],
      textColor: tableStyle === "boxed" ? accentText : muted,
      lineColor: accent,
      lineWidth: tableStyle === "borderless" ? 0 : { top: 0, right: 0, bottom: 1.5, left: 0 } as never,
    },
    bodyStyles: {
      lineColor: [...muted, 0.2] as unknown as [number, number, number],
      lineWidth: tableStyle === "lined" ? { bottom: 0.5 } as never : 0,
    },
    alternateRowStyles:
      tableStyle === "zebra" ? { fillColor: [245, 245, 247] } : undefined,
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right", cellWidth: 60, font: "courier" },
      2: { halign: "right", cellWidth: 80, font: "courier" },
      3: { halign: "right", cellWidth: 90, font: "courier", fontStyle: "bold" },
    },
  });

  // @ts-expect-error autotable adds lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 16;

  // Totals (right-aligned block)
  const totalsW = 240;
  const totalsX = pageW - M - totalsW;
  const rowH = 16;

  const drawRow = (label: string, value: string, color: [number, number, number] = muted, bold = false) => {
    doc.setFont(bodyFont, bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(label, totalsX, y);
    doc.setFont("courier", bold ? "bold" : "normal");
    doc.text(value, totalsX + totalsW, y, { align: "right" });
    y += rowH;
  };

  drawRow("Subtotal", money(invoice.subtotal, currency));
  if (invoice.discount > 0) drawRow("Discount", `- ${money(invoice.discount, currency)}`);
  if (invoice.tax_pct > 0) drawRow(`Tax (${invoice.tax_pct}%)`, money(invoice.tax, currency));

  // Total bar
  y += 4;
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.roundedRect(totalsX, y - 2, totalsW, 24, 4, 4, "F");
  doc.setTextColor(accentText[0], accentText[1], accentText[2]);
  doc.setFont(bodyFont, "bold");
  doc.setFontSize(11);
  doc.text("Total", totalsX + 10, y + 14);
  doc.setFont("courier", "bold");
  doc.text(money(invoice.total, currency), totalsX + totalsW - 10, y + 14, { align: "right" });
  y += 32;

  if (invoice.amount_paid > 0) {
    drawRow("Paid", `- ${money(invoice.amount_paid, currency)}`);
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(1.5);
    doc.roundedRect(totalsX, y - 2, totalsW, 24, 4, 4, "S");
    doc.setTextColor(text[0], text[1], text[2]);
    doc.setFont(bodyFont, "bold");
    doc.setFontSize(11);
    doc.text("Amount Due", totalsX + 10, y + 14);
    doc.setFont("courier", "bold");
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(money(invoice.amount_due, currency), totalsX + totalsW - 10, y + 14, { align: "right" });
    y += 32;
  }

  y += 12;

  // Notes / Terms
  const drawBlock = (heading: string, content: string, x: number, w: number) => {
    doc.setFont(bodyFont, "bold");
    doc.setFontSize(8);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(heading.toUpperCase(), x, y);
    doc.setFont(bodyFont, "normal");
    doc.setFontSize(9);
    doc.setTextColor(text[0], text[1], text[2]);
    const wrapped = doc.splitTextToSize(content, w);
    doc.text(wrapped, x, y + 12);
  };

  if (invoice.notes && invoice.terms) {
    const colW = (pageW - M * 2 - 20) / 2;
    drawBlock("Notes", invoice.notes, M, colW);
    drawBlock("Terms", invoice.terms, M + colW + 20, colW);
  } else if (invoice.notes) {
    drawBlock("Notes", invoice.notes, M, pageW - M * 2);
  } else if (invoice.terms) {
    drawBlock("Terms", invoice.terms, M, pageW - M * 2);
  }

  return doc;
}

export async function downloadInvoicePdf(data: InvoicePreviewData) {
  const doc = await generateInvoicePdf(data);
  doc.save(`${data.invoice.invoice_number || "invoice"}.pdf`);
}
