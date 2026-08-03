import {
  buildEstimateDocument,
  lineTotal,
  lineTax,
  unitCost,
  money,
  type DocLineItem,
} from "@/lib/estimate-document";

export type EstimateDocCompany = {
  name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

export type EstimateDocMeta = {
  estimate_number?: string | null;
  type_of_estimate?: string | null;
  price_list_code?: string | null;
  date?: string | null;
  claim_number?: string | null;
};

export type EstimateDocCustomer = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function EstimateDocument({
  items,
  pcts,
  manualTotal,
  useManualTotal,
  company,
  customer,
  meta,
  hidePricing,
}: {
  items: DocLineItem[];
  pcts: { markup_pct: number; overhead_pct: number; profit_pct: number; tax_pct: number };
  manualTotal?: number | null;
  useManualTotal?: boolean;
  company: EstimateDocCompany | null;
  customer: EstimateDocCustomer;
  meta: EstimateDocMeta;
  hidePricing?: boolean;
}) {
  const doc = buildEstimateDocument(items, {
    ...pcts,
    manual_total: manualTotal ?? null,
    use_manual_total: useManualTotal,
  });

  const showMoney = !hidePricing;

  return (
    <div className="space-y-4">
      {/* Page 1 — header + line items */}
      <section className="est-page" style={pageStyle}>
        <header
          className="flex items-start justify-between gap-6 pb-4"
          style={{ borderBottom: "2px solid #111" }}
        >
          <div className="flex items-start gap-3">
            {company?.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                style={{ maxHeight: 64, maxWidth: 190, objectFit: "contain" }}
                crossOrigin="anonymous"
              />
            ) : null}
            <div style={{ fontSize: 11, lineHeight: 1.5, color: "#111" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{company?.name ?? "Company"}</div>
              {company?.address && <div>{company.address}</div>}
              {company?.phone && <div>{company.phone}</div>}
              {company?.email && <div>{company.email}</div>}
              {company?.website && <div>{company.website}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#111" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>ESTIMATE</div>
            {meta.estimate_number && <div>Estimate #: {meta.estimate_number}</div>}
            {meta.date && <div>Date: {meta.date}</div>}
            {meta.claim_number && <div>Claim #: {meta.claim_number}</div>}
          </div>
        </header>

        <div
          className="grid grid-cols-2 gap-6 py-4"
          style={{ fontSize: 11, color: "#111", borderBottom: "1px solid #ccc" }}
        >
          <div>
            <div style={labelStyle}>Insured / Customer</div>
            <div style={{ fontWeight: 700 }}>{customer.name || "—"}</div>
            {customer.address && <div style={{ whiteSpace: "pre-wrap" }}>{customer.address}</div>}
            {customer.phone && <div>{customer.phone}</div>}
            {customer.email && <div>{customer.email}</div>}
          </div>
          <div>
            <div style={labelStyle}>Estimate Details</div>
            <div>Type of Estimate: {meta.type_of_estimate || "—"}</div>
            <div>Price List: {meta.price_list_code || "—"}</div>
          </div>
        </div>

        {doc.areas.map((area) => (
          <div key={area.area} className="pt-4">
            <div
              style={{
                background: "#111",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "5px 8px",
              }}
            >
              {area.area}
            </div>

            {area.categories.map((cat) => (
              <div key={cat.category} className="pt-2">
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#111",
                    padding: "4px 0",
                  }}
                >
                  {cat.category}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, color: "#111" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #111" }}>
                      <th style={{ ...thStyle, textAlign: "left" }}>DESCRIPTION</th>
                      <th style={{ ...thStyle, width: 74, textAlign: "right" }}>QTY</th>
                      {showMoney && <th style={{ ...thStyle, width: 78, textAlign: "right" }}>REMOVE</th>}
                      {showMoney && <th style={{ ...thStyle, width: 80, textAlign: "right" }}>REPLACE</th>}
                      {showMoney && <th style={{ ...thStyle, width: 66, textAlign: "right" }}>TAX</th>}
                      {showMoney && <th style={{ ...thStyle, width: 86, textAlign: "right" }}>TOTAL</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map((item, idx) => {
                      const rm = Number(item.remove_price ?? 0);
                      const rp = Number(item.replace_price ?? 0);
                      const single = rm === 0 && rp === 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid #e3e3e3" }}>
                          <td style={tdStyle}>
                            <span style={{ color: "#666", marginRight: 6 }}>{idx + 1}.</span>
                            {item.name}
                            {item.note ? (
                              <div style={{ fontSize: 9.5, color: "#555", paddingLeft: 14, whiteSpace: "pre-wrap" }}>
                                {item.note}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {item.qty} {item.unit}
                          </td>
                          {showMoney && (
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {single ? "" : money(rm)}
                            </td>
                          )}
                          {showMoney && (
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {single ? money(unitCost(item)) : money(rp)}
                            </td>
                          )}
                          {showMoney && (
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {money(lineTax(item, pcts.tax_pct))}
                            </td>
                          )}
                          {showMoney && (
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                              {money(lineTotal(item) + lineTax(item, pcts.tax_pct))}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {showMoney && (
                      <tr>
                        <td colSpan={5} style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                          {cat.category} Subtotal
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>
                          {money(cat.subtotal)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}

            {showMoney && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 16,
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "6px 0",
                  borderTop: "2px solid #111",
                  color: "#111",
                }}
              >
                <span>Total: {area.area}</span>
                <span>{money(area.subtotal)}</span>
              </div>
            )}
          </div>
        ))}

        {doc.areas.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 12 }}>
            No line items yet.
          </div>
        )}
      </section>

      {/* Page 2 — recap + totals */}
      {showMoney && doc.areas.length > 0 && (
        <section className="est-page" style={pageStyle}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111", marginBottom: 10 }}>
            Recap by Category
          </div>
          <RecapTable rows={doc.recapByCategory} />

          <div style={{ fontSize: 15, fontWeight: 800, color: "#111", margin: "20px 0 10px" }}>
            Recap by Area
          </div>
          <RecapTable rows={doc.recapByArea} />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
            <div style={{ width: 300, fontSize: 11, color: "#111" }}>
              <TotalRow label="Line Item Subtotal" value={money(doc.subtotal)} />
              {doc.markup > 0 && <TotalRow label={`Markup (${pcts.markup_pct}%)`} value={money(doc.markup)} />}
              {doc.overhead > 0 && (
                <TotalRow label={`Overhead (${pcts.overhead_pct}%)`} value={money(doc.overhead)} />
              )}
              {doc.profit > 0 && <TotalRow label={`Profit (${pcts.profit_pct}%)`} value={money(doc.profit)} />}
              {doc.tax > 0 && <TotalRow label={`Sales Tax (${pcts.tax_pct}%)`} value={money(doc.tax)} />}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "2px solid #111",
                  marginTop: 6,
                  paddingTop: 6,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <span>Estimate Total</span>
                <span>{money(doc.total)}</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function RecapTable({ rows }: { rows: { label: string; amount: number; pct: number }[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, color: "#111" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #111" }}>
          <th style={{ ...thStyle, textAlign: "left" }}>CATEGORY</th>
          <th style={{ ...thStyle, width: 110, textAlign: "right" }}>AMOUNT</th>
          <th style={{ ...thStyle, width: 70, textAlign: "right" }}>%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={{ borderBottom: "1px solid #e3e3e3" }}>
            <td style={tdStyle}>{r.label}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{money(r.amount)}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{r.pct.toFixed(2)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
      <span style={{ color: "#444" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#111111",
  padding: "36px 40px",
  borderRadius: 6,
  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const thStyle: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.06em",
  fontWeight: 800,
  padding: "5px 6px",
  color: "#111",
};

const tdStyle: React.CSSProperties = {
  padding: "5px 6px",
  verticalAlign: "top",
};

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 800,
  color: "#666",
  marginBottom: 3,
};
