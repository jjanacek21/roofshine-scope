// Shared model for the contractor-style estimate document
// (DESCRIPTION | QTY | REMOVE | REPLACE | TAX | TOTAL)

export type DocLineItem = {
  id: string;
  code: string | null;
  name: string;
  note?: string | null;
  trade: string;
  unit: string;
  qty: number;
  unit_price: number;
  remove_price?: number | null;
  replace_price?: number | null;
  category?: string | null;
  subgroup?: string | null;
  area?: string | null;
};

export const DEFAULT_AREA = "Main Level";
export const UNCATEGORIZED = "General";

/** Effective per-unit price: remove + replace when either is set, else unit_price. */
export function unitCost(i: DocLineItem): number {
  const r = Number(i.remove_price ?? 0);
  const p = Number(i.replace_price ?? 0);
  if (r > 0 || p > 0) return r + p;
  return Number(i.unit_price ?? 0);
}

export function lineTotal(i: DocLineItem): number {
  return Number(i.qty ?? 0) * unitCost(i);
}

export function lineTax(i: DocLineItem, taxPct: number): number {
  return (lineTotal(i) * (taxPct || 0)) / 100;
}

export type DocCategoryGroup = {
  category: string;
  items: DocLineItem[];
  subtotal: number;
};

export type DocAreaGroup = {
  area: string;
  categories: DocCategoryGroup[];
  subtotal: number;
};

export type RecapRow = { label: string; amount: number; pct: number };

export type EstimateDocumentModel = {
  areas: DocAreaGroup[];
  recapByCategory: RecapRow[];
  recapByArea: RecapRow[];
  subtotal: number;
  markup: number;
  overhead: number;
  profit: number;
  tax: number;
  total: number;
};

export function buildEstimateDocument(
  items: DocLineItem[],
  opts: {
    markup_pct?: number;
    overhead_pct?: number;
    profit_pct?: number;
    tax_pct?: number;
    manual_total?: number | null;
    use_manual_total?: boolean;
  },
): EstimateDocumentModel {
  const areaMap = new Map<string, Map<string, DocLineItem[]>>();
  for (const item of items) {
    const area = (item.area || DEFAULT_AREA).trim() || DEFAULT_AREA;
    const category = (item.category || UNCATEGORIZED).trim() || UNCATEGORIZED;
    if (!areaMap.has(area)) areaMap.set(area, new Map());
    const catMap = areaMap.get(area)!;
    if (!catMap.has(category)) catMap.set(category, []);
    catMap.get(category)!.push(item);
  }

  const areas: DocAreaGroup[] = Array.from(areaMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([area, catMap]) => {
      const categories: DocCategoryGroup[] = Array.from(catMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([category, list]) => ({
          category,
          items: list,
          subtotal: list.reduce((s, i) => s + lineTotal(i), 0),
        }));
      return {
        area,
        categories,
        subtotal: categories.reduce((s, c) => s + c.subtotal, 0),
      };
    });

  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const markup = (subtotal * (opts.markup_pct ?? 0)) / 100;
  const overhead = (subtotal * (opts.overhead_pct ?? 0)) / 100;
  const profit = (subtotal * (opts.profit_pct ?? 0)) / 100;
  const beforeTax = subtotal + markup + overhead + profit;
  const tax = (beforeTax * (opts.tax_pct ?? 0)) / 100;
  const calcTotal = beforeTax + tax;
  const total = opts.use_manual_total ? Number(opts.manual_total ?? 0) : calcTotal;

  const catTotals = new Map<string, number>();
  for (const item of items) {
    const c = (item.category || UNCATEGORIZED).trim() || UNCATEGORIZED;
    catTotals.set(c, (catTotals.get(c) ?? 0) + lineTotal(item));
  }
  const pct = (n: number) => (subtotal > 0 ? (n / subtotal) * 100 : 0);

  const recapByCategory: RecapRow[] = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ label, amount, pct: pct(amount) }));

  const recapByArea: RecapRow[] = areas.map((a) => ({
    label: a.area,
    amount: a.subtotal,
    pct: pct(a.subtotal),
  }));

  return {
    areas,
    recapByCategory,
    recapByArea,
    subtotal,
    markup,
    overhead,
    profit,
    tax,
    total,
  };
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(n) ? n : 0);
}
