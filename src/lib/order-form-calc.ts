export type Formula = {
  base?: string;
  divide_by?: number;
  waste_pct?: number;
  min?: number;
  fixed?: number;
  use_material_coverage?: boolean;
};

export function calcQty(
  formula: Formula | null | undefined,
  inputs: Record<string, number>,
  materialCoverage?: number | null,
  materialCoverageBase?: string | null,
): number {
  if (!formula) return 0;
  if (formula.fixed !== undefined && formula.fixed !== null) return Number(formula.fixed);
  const baseKey = (formula.use_material_coverage && materialCoverageBase) ? materialCoverageBase : (formula.base ?? "");
  const base = Number(inputs[baseKey] ?? 0) || 0;
  const raw = base * (1 + (Number(formula.waste_pct) || 0) / 100);
  let divisor = Number(formula.divide_by) || 1;
  if (formula.use_material_coverage && materialCoverage && Number(materialCoverage) > 0) {
    divisor = Number(materialCoverage);
  }
  const qty = Math.ceil(raw / divisor);
  return Math.max(Number(formula.min) || 0, qty);
}

export function fmtMoney(n: number): string {
  if (!isFinite(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function fmtNum(n: number, digits = 0): string {
  if (!isFinite(n)) return "0";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export type OrderTotalsInput = {
  matSubtotal: number;
  tax: number;
  laborTotal: number;
  dump: number;
  permits: number;
  extras: number;
  markupPct: number;
  squares: number;
};
export function computeOrderTotals(i: OrderTotalsInput) {
  const matTotal = i.matSubtotal + i.tax;
  const jobCost = matTotal + i.laborTotal + i.dump + i.permits + i.extras;
  const markup = jobCost * (i.markupPct / 100);
  const customerPrice = jobCost + markup;
  const profit = customerPrice - jobCost;
  const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;
  const perSq = i.squares > 0 ? customerPrice / i.squares : 0;
  const costPerSq = i.squares > 0 ? jobCost / i.squares : 0;
  return {
    matSubtotal: i.matSubtotal, tax: i.tax, matTotal,
    laborTotal: i.laborTotal, dump: i.dump, permits: i.permits, extras: i.extras,
    jobCost, markup, customerPrice, profit, margin, perSq, costPerSq,
  };
}

export const INPUT_LABELS: Record<string, string> = {
  sq: "Squares",
  hip_ridge_lf: "Hip/Ridge LF",
  eave_rake_lf: "Eave/Rake LF",
  valley_lf: "Valley LF",
  ridge_vent_lf: "Ridge Vent LF",
  perimeter_lf: "Perimeter LF",
  pipes: "Pipes",
  vents: "Vents",
  deck_sheets: "Deck Sheets",
  gutter_lf: "Gutter LF",
  downspouts: "Downspouts",
  corners: "Corners",
  endcaps: "End Caps",
};
