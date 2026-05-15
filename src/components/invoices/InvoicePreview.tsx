import { format } from "date-fns";

type Layout = {
  accent?: string;
  accent_text?: string;
  bg?: string;
  text?: string;
  muted?: string;
  heading_font?: "sans-serif" | "serif" | "mono";
  body_font?: "sans-serif" | "serif" | "mono";
  header_style?: "banner" | "split" | "clean" | "block";
  table_style?: "lined" | "zebra" | "borderless" | "boxed";
  logo_position?: "left" | "right";
  show_accent_stripe?: boolean;
};

type Line = {
  id?: string;
  name: string;
  description?: string | null;
  qty: number;
  unit?: string;
  unit_price: number;
  total?: number;
};

export type InvoicePreviewData = {
  invoice: {
    invoice_number: string;
    issue_date: string;
    due_date?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    notes?: string | null;
    terms?: string | null;
    subtotal: number;
    discount: number;
    tax_pct: number;
    tax: number;
    total: number;
    amount_paid: number;
    amount_due: number;
    currency?: string;
  };
  lines: Line[];
  company: {
    name: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  layout?: Layout | null;
};

const FONT_MAP: Record<string, string> = {
  "sans-serif": "Inter, system-ui, -apple-system, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
};

function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n || 0);
}

export function InvoicePreview({ invoice, lines, company, layout }: InvoicePreviewData) {
  const L: Required<Layout> = {
    accent: layout?.accent || "#1e40af",
    accent_text: layout?.accent_text || "#ffffff",
    bg: layout?.bg || "#ffffff",
    text: layout?.text || "#0f172a",
    muted: layout?.muted || "#64748b",
    heading_font: layout?.heading_font || "sans-serif",
    body_font: layout?.body_font || "sans-serif",
    header_style: layout?.header_style || "banner",
    table_style: layout?.table_style || "lined",
    logo_position: layout?.logo_position || "left",
    show_accent_stripe: layout?.show_accent_stripe ?? true,
  };

  const isBanner = L.header_style === "banner";
  const isBlock = L.header_style === "block";

  return (
    <div
      style={{
        background: L.bg,
        color: L.text,
        fontFamily: FONT_MAP[L.body_font],
        padding: 0,
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        minHeight: 800,
      }}
    >
      {L.show_accent_stripe && <div style={{ height: 6, background: L.accent }} />}

      {/* Header */}
      <div
        style={{
          padding: "32px 40px 24px",
          background: isBanner || isBlock ? L.accent : "transparent",
          color: isBanner || isBlock ? L.accent_text : L.text,
          display: "flex",
          flexDirection: L.logo_position === "right" ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
        }}
      >
        <div style={{ flex: 1 }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.name} style={{ maxHeight: 56, marginBottom: 12 }} />
          ) : (
            <div style={{ fontFamily: FONT_MAP[L.heading_font], fontSize: 22, fontWeight: 800 }}>
              {company?.name || "Your Company"}
            </div>
          )}
          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
            {company?.address && <div>{company.address}</div>}
            {company?.phone && <div>{company.phone}</div>}
            {company?.email && <div>{company.email}</div>}
          </div>
        </div>
        <div style={{ textAlign: L.logo_position === "right" ? "left" : "right" }}>
          <div style={{ fontFamily: FONT_MAP[L.heading_font], fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>
            INVOICE
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{invoice.invoice_number}</div>
        </div>
      </div>

      {/* Bill to + dates */}
      <div style={{ padding: "24px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: L.muted, marginBottom: 6, fontWeight: 700 }}>
            Bill To
          </div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{invoice.customer_name || "—"}</div>
          {invoice.customer_address && <div style={{ fontSize: 12, color: L.muted, whiteSpace: "pre-wrap" }}>{invoice.customer_address}</div>}
          {invoice.customer_email && <div style={{ fontSize: 12, color: L.muted }}>{invoice.customer_email}</div>}
          {invoice.customer_phone && <div style={{ fontSize: 12, color: L.muted }}>{invoice.customer_phone}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: L.muted, marginRight: 8 }}>Issue Date</span>
            <strong>{format(new Date(invoice.issue_date), "MMM d, yyyy")}</strong>
          </div>
          {invoice.due_date && (
            <div>
              <span style={{ color: L.muted, marginRight: 8 }}>Due Date</span>
              <strong>{format(new Date(invoice.due_date), "MMM d, yyyy")}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div style={{ padding: "0 40px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr
              style={{
                background: L.table_style === "boxed" ? L.accent : "transparent",
                color: L.table_style === "boxed" ? L.accent_text : L.muted,
                borderBottom: L.table_style === "borderless" ? "none" : `2px solid ${L.accent}`,
              }}
            >
              <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Description</th>
              <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, width: 70 }}>Qty</th>
              <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, width: 110 }}>Price</th>
              <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, width: 120 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: L.muted }}>
                  No line items yet.
                </td>
              </tr>
            ) : (
              lines.map((line, i) => (
                <tr
                  key={line.id || i}
                  style={{
                    background: L.table_style === "zebra" && i % 2 === 1 ? "rgba(0,0,0,0.03)" : "transparent",
                    borderBottom: L.table_style === "lined" ? `1px solid ${L.muted}33` : "none",
                  }}
                >
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ fontWeight: 600 }}>{line.name}</div>
                    {line.description && <div style={{ color: L.muted, fontSize: 12 }}>{line.description}</div>}
                  </td>
                  <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: FONT_MAP.mono }}>{line.qty} {line.unit || ""}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: FONT_MAP.mono }}>{money(line.unit_price, invoice.currency)}</td>
                  <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: FONT_MAP.mono, fontWeight: 600 }}>
                    {money((line.total ?? line.qty * line.unit_price), invoice.currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ padding: "16px 40px", display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280, fontSize: 13 }}>
          <Row label="Subtotal" value={money(invoice.subtotal, invoice.currency)} muted={L.muted} />
          {invoice.discount > 0 && <Row label="Discount" value={`- ${money(invoice.discount, invoice.currency)}`} muted={L.muted} />}
          {invoice.tax_pct > 0 && <Row label={`Tax (${invoice.tax_pct}%)`} value={money(invoice.tax, invoice.currency)} muted={L.muted} />}
          <div style={{ marginTop: 8, padding: "10px 12px", background: L.accent, color: L.accent_text, borderRadius: 6, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span>
            <span style={{ fontFamily: FONT_MAP.mono }}>{money(invoice.total, invoice.currency)}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <>
              <Row label="Paid" value={`- ${money(invoice.amount_paid, invoice.currency)}`} muted={L.muted} top />
              <div style={{ padding: "10px 12px", border: `2px solid ${L.accent}`, borderRadius: 6, display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 4 }}>
                <span>Amount Due</span>
                <span style={{ fontFamily: FONT_MAP.mono, color: L.accent }}>{money(invoice.amount_due, invoice.currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes / Terms */}
      {(invoice.notes || invoice.terms) && (
        <div style={{ padding: "16px 40px 40px", display: "grid", gridTemplateColumns: invoice.notes && invoice.terms ? "1fr 1fr" : "1fr", gap: 24, fontSize: 12 }}>
          {invoice.notes && (
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: L.muted, fontWeight: 700, marginBottom: 4 }}>Notes</div>
              <div style={{ whiteSpace: "pre-wrap", color: L.text }}>{invoice.notes}</div>
            </div>
          )}
          {invoice.terms && (
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: L.muted, fontWeight: 700, marginBottom: 4 }}>Terms</div>
              <div style={{ whiteSpace: "pre-wrap", color: L.text }}>{invoice.terms}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted, top }: { label: string; value: string; muted: string; top?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", color: muted, marginTop: top ? 8 : 0 }}>
      <span>{label}</span>
      <span style={{ fontFamily: FONT_MAP.mono }}>{value}</span>
    </div>
  );
}
