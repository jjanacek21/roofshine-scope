// Carrier-style (Xactimate) estimate report model + calculations.
// Display rounds to 2 decimals; all math keeps full precision internally.

export type ReportLineItem = {
  id: string;
  code?: string | null;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
  /** Optional per-item tax override. When null, tax = qty * unit_price * taxPct/100 */
  tax_amount?: number | null;
  depreciation_pct?: number | null;
  depreciation_amount?: number | null;
  depreciation_recoverable?: boolean | null;
  not_yet_incurred?: boolean | null;
  area?: string | null;
};

export function itemBase(i: ReportLineItem): number {
  return Number(i.qty ?? 0) * Number(i.unit_price ?? 0);
}

export function itemTax(i: ReportLineItem, taxPct: number): number {
  if (i.tax_amount !== null && i.tax_amount !== undefined) return Number(i.tax_amount);
  return (itemBase(i) * (Number(taxPct) || 0)) / 100;
}

export function itemRcv(i: ReportLineItem, taxPct: number): number {
  return itemBase(i) + itemTax(i, taxPct);
}

export function itemDepreciation(i: ReportLineItem, taxPct: number): number {
  if (i.depreciation_amount !== null && i.depreciation_amount !== undefined) {
    return Number(i.depreciation_amount);
  }
  if (i.depreciation_pct !== null && i.depreciation_pct !== undefined) {
    return (itemRcv(i, taxPct) * Number(i.depreciation_pct)) / 100;
  }
  return 0;
}

export function itemAcv(i: ReportLineItem, taxPct: number): number {
  return itemRcv(i, taxPct) - itemDepreciation(i, taxPct);
}

export function isIncluded(i: ReportLineItem): boolean {
  return !i.not_yet_incurred;
}

export type ReportTotals = {
  lineItemTotal: number;
  materialSalesTax: number;
  markup: number;
  overhead: number;
  profit: number;
  overheadAndProfit: number;
  replacementCostValue: number;
  depreciation: number;
  actualCashValue: number;
  deductible: number;
  netClaim: number;
  recoverableDepreciation: number;
  netClaimIfDepreciationRecovered: number;
};

export function rollup(
  items: ReportLineItem[],
  opts: {
    taxPct: number;
    deductible?: number;
    markupPct?: number;
    overheadPct?: number;
    profitPct?: number;
  },
): ReportTotals {
  const taxPct = Number(opts.taxPct) || 0;
  const included = items.filter(isIncluded);

  const materialSalesTax = included.reduce((s, i) => s + itemTax(i, taxPct), 0);
  const baseRcv = included.reduce((s, i) => s + itemRcv(i, taxPct), 0);
  const lineItemTotal = baseRcv - materialSalesTax;

  const markup = (lineItemTotal * (Number(opts.markupPct) || 0)) / 100;
  const overhead = (lineItemTotal * (Number(opts.overheadPct) || 0)) / 100;
  const profit = (lineItemTotal * (Number(opts.profitPct) || 0)) / 100;
  const overheadAndProfit = markup + overhead + profit;

  const replacementCostValue = baseRcv + overheadAndProfit;
  const depreciation = included.reduce((s, i) => s + itemDepreciation(i, taxPct), 0);
  const actualCashValue = replacementCostValue - depreciation;
  const deductible = Number(opts.deductible ?? 0) || 0;
  const netClaim = actualCashValue - deductible;
  const recoverableDepreciation = included.reduce(
    (s, i) => s + (i.depreciation_recoverable === false ? 0 : itemDepreciation(i, taxPct)),
    0,
  );

  return {
    lineItemTotal,
    materialSalesTax,
    markup,
    overhead,
    profit,
    overheadAndProfit,
    replacementCostValue,
    depreciation,
    actualCashValue,
    deductible,
    netClaim,
    recoverableDepreciation,
    netClaimIfDepreciationRecovered: netClaim + recoverableDepreciation,
  };
}


/** Sum of tax / rcv / dep / acv for an arbitrary subset (section or level totals). */
export function subsetTotals(items: ReportLineItem[], taxPct: number) {
  const included = items.filter(isIncluded);
  return {
    tax: included.reduce((s, i) => s + itemTax(i, taxPct), 0),
    rcv: included.reduce((s, i) => s + itemRcv(i, taxPct), 0),
    dep: included.reduce((s, i) => s + itemDepreciation(i, taxPct), 0),
    acv: included.reduce((s, i) => s + itemAcv(i, taxPct), 0),
  };
}

export function num(n: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function paren(n: number): string {
  return `(${num(Math.abs(n))})`;
}

export function usd(n: number): string {
  return `$${num(n)}`;
}

// ---- Measurements -----------------------------------------------------------

export type SectionMeasurements = {
  surfaceArea?: number | null;
  squares?: number | null;
  perimeter?: number | null;
  ridge?: number | null;
  hip?: number | null;
  valley?: number | null;
  sketchUrl?: string | null;
};

export function sumMeasurements(
  all: SectionMeasurements[],
): Required<Omit<SectionMeasurements, "sketchUrl">> {
  const add = (k: keyof SectionMeasurements) =>
    all.reduce((s, m) => s + (Number(m[k] ?? 0) || 0), 0);
  return {
    surfaceArea: add("surfaceArea"),
    squares: add("squares"),
    perimeter: add("perimeter"),
    ridge: add("ridge"),
    hip: add("hip"),
    valley: add("valley"),
  };
}

// ---- Notes ------------------------------------------------------------------

export type ReportNote = { id: string; title: string; body: string };
