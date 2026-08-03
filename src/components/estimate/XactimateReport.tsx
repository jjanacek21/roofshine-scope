import { Fragment, type CSSProperties, type ReactNode } from "react";
import {
  itemTax,
  itemRcv,
  itemDepreciation,
  itemAcv,
  itemBase,
  rollup,
  subsetTotals,
  num,
  paren,
  type ReportLineItem,
  type ReportNote,
  type SectionMeasurements,
} from "@/lib/xact-report";

export type ReportProfile = {
  companyName: string;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  businessPhone?: string | null;
  claimsEmail?: string | null;
  website?: string | null;
  estimatorName?: string | null;
  estimatorPosition?: string | null;
  estimatorLicense?: string | null;
  legalStatute?: string | null;
  legalNotice?: string | null;
  fraudWarning?: string | null;
};

export type CoverMeta = {
  insuredName?: string | null;
  insuredPhone?: string | null;
  insuredEmail?: string | null;
  homeAddress?: string | null;
  propertyAddress?: string | null;
  claimRepName?: string | null;
  claimRepCompany?: string | null;
  claimRepPhone?: string | null;
  claimRepEmail?: string | null;
  referenceName?: string | null;
  referenceCompany?: string | null;
  referencePhone?: string | null;
  referenceEmail?: string | null;
  claimNumber?: string | null;
  policyNumber?: string | null;
  typeOfLoss?: string | null;
  dateContacted?: string | null;
  dateOfLoss?: string | null;
  dateInspected?: string | null;
  dateReceived?: string | null;
  dateEntered?: string | null;
  dateCompleted?: string | null;
  priceListCode?: string | null;
  priceListDescription?: string | null;
  estimateName?: string | null;
  coverageLabel?: string | null;
  reportDate?: string | null;
};

export type ReportItem = ReportLineItem & {
  code?: string | null;
  note?: string | null;
  category?: string | null;
};

type Props = {
  profile: ReportProfile;
  meta: CoverMeta;
  items: ReportItem[];
  taxPct: number;
  deductible: number;
  notes?: ReportNote[];
  /** keyed by section (line item `area`) */
  measurements?: Record<string, SectionMeasurements>;
};

// ---------------------------------------------------------------- pagination

const PAGE_CAPACITY = 40;
const ROW_WEIGHT = 2;
const NOTE_WEIGHT = 1;
const SECTION_HEADER_WEIGHT = 3;
const MEASUREMENT_WEIGHT = 8;
const SECTION_TOTAL_WEIGHT = 3;

type Block = { weight: number; node: ReactNode; key: string };

function packBlocks(blocks: Block[]): Block[][] {
  const pages: Block[][] = [];
  let current: Block[] = [];
  let used = 0;
  for (const b of blocks) {
    if (used + b.weight > PAGE_CAPACITY && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(b);
    used += b.weight;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

// ------------------------------------------------------------------ component

export function XactimateReport({
  profile,
  meta,
  items,
  taxPct,
  deductible,
  notes = [],
  measurements = {},
}: Props) {
  const totals = rollup(items, { taxPct, deductible });
  const reportDate = meta.reportDate ?? new Date().toLocaleDateString("en-US");

  // Group into sections by `area`, preserving first-seen order.
  const sectionOrder: string[] = [];
  const bySection = new Map<string, ReportItem[]>();
  for (const it of items) {
    const key = (it.area || "General").trim() || "General";
    if (!bySection.has(key)) {
      bySection.set(key, []);
      sectionOrder.push(key);
    }
    bySection.get(key)!.push(it);
  }

  let rowNumber = 0;
  const blocks: Block[] = [];

  for (const section of sectionOrder) {
    const list = bySection.get(section)!;
    const m = measurements[section];
    blocks.push({
      key: `h-${section}`,
      weight: SECTION_HEADER_WEIGHT + (m ? MEASUREMENT_WEIGHT : 0),
      node: <SectionHeader name={section} measurements={m} />,
    });
    blocks.push({ key: `th-${section}`, weight: 2, node: <ItemsHead /> });
    for (const it of list) {
      rowNumber += 1;
      const n = rowNumber;
      blocks.push({
        key: `r-${it.id}`,
        weight: ROW_WEIGHT + (it.note ? NOTE_WEIGHT : 0),
        node: <ItemRow index={n} item={it} taxPct={taxPct} />,
      });
    }
    const st = subsetTotals(list, taxPct);
    blocks.push({
      key: `t-${section}`,
      weight: SECTION_TOTAL_WEIGHT,
      node: <SectionTotals name={section} tax={st.tax} rcv={st.rcv} dep={st.dep} acv={st.acv} />,
    });
  }

  const itemPages = packBlocks(blocks);

  // Recaps
  const roomRows = sectionOrder.map((s) => {
    const st = subsetTotals(bySection.get(s)!, taxPct);
    return { label: s, amount: st.rcv - st.tax, pct: 0, tax: st.tax };
  });
  const roomBase = roomRows.reduce((s, r) => s + r.amount, 0);
  roomRows.forEach((r) => (r.pct = roomBase > 0 ? (r.amount / roomBase) * 100 : 0));

  const catMap = new Map<string, { amount: number; tax: number }>();
  for (const it of items) {
    if (it.not_yet_incurred) continue;
    const key = (it.category || "GENERAL").toUpperCase();
    const prev = catMap.get(key) ?? { amount: 0, tax: 0 };
    catMap.set(key, {
      amount: prev.amount + itemBase(it),
      tax: prev.tax + itemTax(it, taxPct),
    });
  }
  const catRows = Array.from(catMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, v]) => ({
      label,
      amount: v.amount,
      tax: v.tax,
      pct: totals.lineItemTotal > 0 ? (v.amount / totals.lineItemTotal) * 100 : 0,
    }));

  const notIncurred = items.filter((i) => i.not_yet_incurred);

  // Assemble the pages
  const pages: ReactNode[] = [];
  pages.push(<CoverPage key="cover" profile={profile} meta={meta} deductible={deductible} />);
  itemPages.forEach((page, i) => {
    pages.push(
      <div key={`items-${i}`}>
        {page.map((b) => (
          <Fragment key={b.key}>{b.node}</Fragment>
        ))}
      </div>,
    );
  });
  pages.push(
    <RecapPage
      key="recap"
      roomRows={roomRows}
      catRows={catRows}
      taxPct={taxPct}
      lineItemTotal={totals.lineItemTotal}
      materialTax={totals.materialSalesTax}
    />,
  );
  pages.push(
    <SummaryPage
      key="summary"
      totals={totals}
      profile={profile}
      notIncurred={notIncurred}
      taxPct={taxPct}
    />,
  );
  if (notes.length > 0) {
    pages.push(<NotesPage key="notes" notes={notes} />);
  }

  const total = pages.length;

  return (
    <div className="xr-root space-y-4">
      {pages.map((content, i) => (
        <section className="xr-page est-page" style={pageStyle} key={i}>
          <Letterhead profile={profile} />
          <div className="xr-body" style={{ flex: 1 }}>
            {content}
          </div>
          <Footer
            profile={profile}
            date={reportDate}
            estimateName={meta.estimateName}
            page={i + 1}
            total={total}
          />
        </section>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------- chrome

function Letterhead({ profile }: { profile: ReportProfile }) {
  return (
    <header
      className="xr-letterhead"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 18,
        borderBottom: "1.5px solid #000",
        paddingBottom: 8,
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {profile.logoUrl ? (
          <img
            src={profile.logoUrl}
            alt={profile.companyName}
            crossOrigin="anonymous"
            style={{ maxHeight: 58, maxWidth: 170, objectFit: "contain" }}
          />
        ) : null}
        <div style={{ fontSize: 10.5, lineHeight: 1.35 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{profile.companyName}</div>
          {profile.addressLine1 && <div>{profile.addressLine1}</div>}
          {profile.addressLine2 && <div>{profile.addressLine2}</div>}
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 10.5, lineHeight: 1.35 }}>
        {profile.businessPhone && <div>Business: {profile.businessPhone}</div>}
        {profile.claimsEmail && <div>E-mail: {profile.claimsEmail}</div>}
        {profile.website && <div>{profile.website}</div>}
        {profile.estimatorLicense && <div>License: {profile.estimatorLicense}</div>}
      </div>
    </header>
  );
}

function Footer({
  profile,
  date,
  estimateName,
  page,
  total,
}: {
  profile: ReportProfile;
  date: string;
  estimateName?: string | null;
  page: number;
  total: number;
}) {
  return (
    <footer
      className="xr-footer"
      style={{
        borderTop: "1px solid #000",
        marginTop: 12,
        paddingTop: 5,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 9.5,
      }}
    >
      <span>{estimateName || profile.companyName}</span>
      <span>{date}</span>
      <span>
        Page: {page} of {total}
      </span>
    </footer>
  );
}

// --------------------------------------------------------------- cover page

function CoverPage({
  profile,
  meta,
  deductible,
}: {
  profile: ReportProfile;
  meta: CoverMeta;
  deductible: number;
}) {
  return (
    <div style={{ fontSize: 11, lineHeight: 1.45 }}>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
        {(meta.estimateName || "ESTIMATE").toUpperCase()}
      </div>

      <Party label="Insured" lines={[meta.insuredName, meta.insuredPhone, meta.insuredEmail]} />
      <Party label="Home" lines={[meta.homeAddress]} />
      <Party label="Property" lines={[meta.propertyAddress]} />
      <Party
        label="Claim Rep."
        lines={[meta.claimRepName, meta.claimRepCompany, meta.claimRepPhone, meta.claimRepEmail]}
      />
      <Party
        label="Estimator"
        lines={[
          profile.estimatorName,
          profile.estimatorPosition,
          profile.companyName,
          profile.businessPhone,
          profile.claimsEmail,
        ]}
      />
      <Party
        label="Reference"
        lines={[
          meta.referenceName,
          meta.referenceCompany,
          meta.referencePhone,
          meta.referenceEmail,
        ]}
      />

      <div style={{ borderTop: "1px solid #000", margin: "12px 0" }} />

      <FieldGrid
        rows={[
          ["Claim Number", meta.claimNumber],
          ["Policy Number", meta.policyNumber],
          ["Type of Loss", meta.typeOfLoss],
        ]}
      />
      <div style={{ height: 8 }} />
      <FieldGrid
        rows={[
          ["Date Contacted", meta.dateContacted],
          ["Date of Loss", meta.dateOfLoss],
          ["Date Inspected", meta.dateInspected],
          ["Date Received", meta.dateReceived],
          ["Date Entered", meta.dateEntered],
          ["Date Est. Completed", meta.dateCompleted],
        ]}
      />
      <div style={{ height: 8 }} />
      <FieldGrid
        rows={[
          ["Price List", meta.priceListCode],
          ["", meta.priceListDescription],
          ["Estimate", meta.estimateName],
          ["Coverage", meta.coverageLabel],
          ["Deductible", `$${num(deductible)}`],
        ]}
      />

      <div style={{ borderTop: "1px solid #000", margin: "14px 0 10px" }} />

      {[profile.legalStatute, profile.legalNotice, profile.fraudWarning]
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} style={{ fontSize: 10, textAlign: "justify", marginBottom: 9 }}>
            {p}
          </p>
        ))}
    </div>
  );
}

function Party({ label, lines }: { label: string; lines: (string | null | undefined)[] }) {
  const clean = lines.filter(Boolean) as string[];
  if (clean.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
      <div style={{ width: 110, fontWeight: 700 }}>{label}:</div>
      <div>
        {clean.map((l, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap" }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldGrid({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <div>
      {rows
        .filter(([, v]) => Boolean(v))
        .map(([k, v], i) => (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 160, fontWeight: k ? 700 : 400 }}>{k ? `${k}:` : ""}</div>
            <div>{v}</div>
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------- line items

function SectionHeader({
  name,
  measurements,
}: {
  name: string;
  measurements?: SectionMeasurements;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: 11.5,
          borderBottom: "1px solid #000",
          paddingBottom: 2,
        }}
      >
        {name}
      </div>
      {measurements ? (
        <div style={{ display: "flex", gap: 18, marginTop: 6, fontSize: 10 }}>
          {measurements.sketchUrl ? (
            <img
              src={measurements.sketchUrl}
              alt={`${name} sketch`}
              crossOrigin="anonymous"
              style={{ width: 150, objectFit: "contain", border: "1px solid #999" }}
            />
          ) : null}
          <table style={{ fontSize: 10, borderCollapse: "collapse" }}>
            <tbody>
              <MeasureRow label="Total Surface Area" value={measurements.surfaceArea} unit="SF" />
              <MeasureRow label="Total Roof Squares" value={measurements.squares} unit="SQ" />
              <MeasureRow label="Total Perimeter Length" value={measurements.perimeter} unit="LF" />
              <MeasureRow label="Total Ridge Length" value={measurements.ridge} unit="LF" />
              <MeasureRow label="Total Hip Length" value={measurements.hip} unit="LF" />
              <MeasureRow label="Total Valley Length" value={measurements.valley} unit="LF" />
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function MeasureRow({
  label,
  value,
  unit,
}: {
  label: string;
  value?: number | null;
  unit: string;
}) {
  if (!value) return null;
  return (
    <tr>
      <td style={{ paddingRight: 14 }}>{label}</td>
      <td style={{ textAlign: "right", fontWeight: 700 }}>
        {num(Number(value))} {unit}
      </td>
    </tr>
  );
}

/** Shared column widths so head / rows / totals line up across separate tables. */
function ItemCols() {
  return (
    <colgroup>
      <col style={{ width: 26 }} />
      <col />
      <col style={{ width: 78 }} />
      <col style={{ width: 68 }} />
      <col style={{ width: 52 }} />
      <col style={{ width: 76 }} />
      <col style={{ width: 76 }} />
      <col style={{ width: 76 }} />
    </colgroup>
  );
}

function ItemsHead() {
  return (
    <table style={tableStyle}>
      <ItemCols />
      <thead>
        <tr style={{ borderBottom: "1px solid #000" }}>
          <th style={{ ...th, textAlign: "left" }}>#</th>
          <th style={{ ...th, textAlign: "left" }}>DESCRIPTION</th>
          <th style={th}>QUANTITY</th>
          <th style={th}>UNIT PRICE</th>
          <th style={th}>TAX</th>
          <th style={th}>RCV</th>
          <th style={th}>DEPREC.</th>
          <th style={th}>ACV</th>
        </tr>
      </thead>
    </table>
  );
}

function ItemRow({
  index,
  item,
  taxPct,
}: {
  index: number;
  item: ReportItem;
  taxPct: number;
}) {
  const struck = Boolean(item.not_yet_incurred);
  const strike: CSSProperties = struck
    ? { textDecoration: "line-through", color: "#444" }
    : {};
  const dep = itemDepreciation(item, taxPct);
  return (
    <table style={tableStyle}>
      <ItemCols />
      <tbody>
        <tr>
          <td style={{ ...td, ...strike }}>{index}.</td>
          <td style={{ ...td, ...strike }}>
            {item.name}
            {item.code ? <span style={{ color: "#666" }}> ({item.code})</span> : null}
          </td>
          <td style={{ ...td, textAlign: "right", ...strike }}>
            {num(Number(item.qty))} {item.unit}
          </td>
          <td style={{ ...td, textAlign: "right", ...strike }}>{num(Number(item.unit_price))}</td>
          <td style={{ ...td, textAlign: "right", ...strike }}>{num(itemTax(item, taxPct))}</td>
          <td style={{ ...td, textAlign: "right", ...strike }}>{num(itemRcv(item, taxPct))}</td>
          <td style={{ ...td, textAlign: "right", ...strike }}>{dep ? paren(dep) : "(0.00)"}</td>
          <td style={{ ...td, textAlign: "right", ...strike }}>{num(itemAcv(item, taxPct))}</td>
        </tr>
        {item.note || struck ? (
          <tr>
            <td style={td} />
            <td colSpan={7} style={{ ...td, paddingTop: 0 }}>
              {struck ? "The payment for this item has not yet been incurred." : ""}
              {struck && item.note ? " " : ""}
              {item.note}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function SectionTotals({
  name,
  tax,
  rcv,
  dep,
  acv,
}: {
  name: string;
  tax: number;
  rcv: number;
  dep: number;
  acv: number;
}) {
  return (
    <table style={{ ...tableStyle, marginBottom: 10 }}>
      <ItemCols />
      <tbody>
        <tr style={{ borderTop: "1px solid #000", borderBottom: "3px double #000" }}>
          <td colSpan={4} style={{ ...td, fontWeight: 700, paddingTop: 4, paddingBottom: 4 }}>
            Totals: {name}
          </td>
          <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{num(tax)}</td>
          <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{num(rcv)}</td>
          <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{num(dep)}</td>
          <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{num(acv)}</td>
        </tr>
      </tbody>
    </table>
  );
}


// -------------------------------------------------------------------- recaps

function RecapPage({
  roomRows,
  catRows,
  taxPct,
  lineItemTotal,
  materialTax,
}: {
  roomRows: { label: string; amount: number; pct: number }[];
  catRows: { label: string; amount: number; tax: number; pct: number }[];
  taxPct: number;
  lineItemTotal: number;
  materialTax: number;
}) {
  return (
    <div style={{ fontSize: 10.5 }}>
      <div style={heading}>Recap by Room</div>
      <table style={tableStyle}>
        <thead>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th, textAlign: "left" }}>AREA</th>
            <th style={{ ...th, width: 110 }}>AMOUNT</th>
            <th style={{ ...th, width: 70 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {roomRows.map((r) => (
            <tr key={r.label} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={td}>{r.label}</td>
              <td style={{ ...td, textAlign: "right" }}>{num(r.amount)}</td>
              <td style={{ ...td, textAlign: "right" }}>{r.pct.toFixed(2)}%</td>
            </tr>
          ))}
          <tr style={{ borderTop: "1.5px solid #000" }}>
            <td style={{ ...td, fontWeight: 700 }}>Line Item Subtotals</td>
            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{num(lineItemTotal)}</td>
            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>100.00%</td>
          </tr>
        </tbody>
      </table>

      <div style={{ ...heading, marginTop: 18 }}>Recap of Taxes</div>
      <table style={tableStyle}>
        <thead>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th, textAlign: "left" }}>TAX</th>
            <th style={{ ...th, width: 110 }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #ddd" }}>
            <td style={td}>Material Sales Tax ({num(taxPct)}%)</td>
            <td style={{ ...td, textAlign: "right" }}>{num(materialTax)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ ...heading, marginTop: 18 }}>Recap by Category</div>
      <table style={tableStyle}>
        <thead>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ ...th, textAlign: "left" }}>CATEGORY</th>
            <th style={{ ...th, width: 110 }}>AMOUNT</th>
            <th style={{ ...th, width: 70 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {catRows.map((r) => (
            <tr key={r.label} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={td}>{r.label}</td>
              <td style={{ ...td, textAlign: "right" }}>{num(r.amount)}</td>
              <td style={{ ...td, textAlign: "right" }}>{r.pct.toFixed(2)}%</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, fontWeight: 700 }}>Subtotal</td>
            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{num(lineItemTotal)}</td>
            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>100.00%</td>
          </tr>
          <tr>
            <td style={td}>Material Sales Tax</td>
            <td style={{ ...td, textAlign: "right" }}>{num(materialTax)}</td>
            <td style={{ ...td, textAlign: "right" }}>
              {lineItemTotal > 0 ? ((materialTax / lineItemTotal) * 100).toFixed(2) : "0.00"}%
            </td>
          </tr>
          <tr style={{ borderTop: "1.5px solid #000" }}>
            <td style={{ ...td, fontWeight: 700 }}>Total</td>
            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
              {num(lineItemTotal + materialTax)}
            </td>
            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>100.00%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------- summary

function SummaryPage({
  totals,
  profile,
  notIncurred,
  taxPct,
}: {
  totals: ReturnType<typeof rollup>;
  profile: ReportProfile;
  notIncurred: ReportItem[];
  taxPct: number;
}) {
  return (
    <div style={{ fontSize: 11 }}>
      <div style={heading}>Summary</div>
      <table style={{ ...tableStyle, maxWidth: 460 }}>
        <tbody>
          <SumRow label="Line Item Total" value={num(totals.lineItemTotal)} />
          <SumRow label="Material Sales Tax" value={num(totals.materialSalesTax)} />
          <SumRow label="Replacement Cost Value" value={`$${num(totals.replacementCostValue)}`} bold />
          <SumRow label="Less Depreciation" value={paren(totals.depreciation)} />
          <SumRow label="Actual Cash Value" value={`$${num(totals.actualCashValue)}`} bold />
          <SumRow label="Less Deductible" value={paren(totals.deductible)} />
          <SumRow label="Net Claim" value={`$${num(totals.netClaim)}`} bold rule />
          <SumRow
            label="Total Recoverable Depreciation"
            value={num(totals.recoverableDepreciation)}
          />
          <SumRow
            label="Net Claim If Depreciation Is Recovered"
            value={`$${num(totals.netClaimIfDepreciationRecovered)}`}
            bold
            rule
          />
        </tbody>
      </table>

      {notIncurred.length > 0 && (
        <div style={{ marginTop: 18, fontSize: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            Items where payment has not yet been incurred (excluded from all totals)
          </div>
          {notIncurred.map((i) => (
            <div key={i.id} style={{ textDecoration: "line-through", color: "#555" }}>
              {i.name} — {num(Number(i.qty))} {i.unit} @ {num(Number(i.unit_price))} (RCV{" "}
              {num(itemRcv(i, taxPct))})
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 46, fontSize: 11 }}>
        <div style={{ borderTop: "1px solid #000", width: 260, paddingTop: 4 }}>
          {profile.estimatorName || "Estimator"}
        </div>
        {profile.estimatorPosition && <div>{profile.estimatorPosition}</div>}
        <div>{profile.companyName}</div>
      </div>
    </div>
  );
}

function SumRow({
  label,
  value,
  bold,
  rule,
}: {
  label: string;
  value: string;
  bold?: boolean;
  rule?: boolean;
}) {
  return (
    <tr style={rule ? { borderTop: "1.5px solid #000" } : undefined}>
      <td style={{ ...td, fontWeight: bold ? 700 : 400 }}>{label}</td>
      <td style={{ ...td, textAlign: "right", fontWeight: bold ? 700 : 400, width: 140 }}>
        {value}
      </td>
    </tr>
  );
}

function NotesPage({ notes }: { notes: ReportNote[] }) {
  return (
    <div style={{ fontSize: 11 }}>
      <div style={heading}>Notes</div>
      {notes.map((n) => (
        <div key={n.id} style={{ marginBottom: 12 }}>
          {n.title && <div style={{ fontWeight: 700 }}>{n.title}</div>}
          <p style={{ textAlign: "justify", whiteSpace: "pre-wrap" }}>{n.body}</p>
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------- styles

const pageStyle: CSSProperties = {
  background: "#ffffff",
  color: "#000000",
  width: "8.5in",
  minHeight: "11in",
  maxWidth: "100%",
  margin: "0 auto",
  padding: "0.5in 0.55in",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  fontFamily: '"Times New Roman", Times, serif',
  boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  fontSize: 10.5,
};

const th: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.04em",
  padding: "3px 4px",
  textAlign: "right",
};

const td: CSSProperties = {
  padding: "3px 4px",
  verticalAlign: "top",
  wordBreak: "break-word",
};

const heading: CSSProperties = {
  fontWeight: 700,
  fontSize: 12.5,
  borderBottom: "1.5px solid #000",
  paddingBottom: 3,
  marginBottom: 8,
};
