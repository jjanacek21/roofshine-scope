export type Formula = {
  base?: string;
  divide_by?: number;
  waste_pct?: number;
  min?: number;
  fixed?: number;
};

export function calcQty(formula: Formula | null | undefined, inputs: Record<string, number>): number {
  if (!formula) return 0;
  if (formula.fixed !== undefined && formula.fixed !== null) return Number(formula.fixed);
  const base = Number(inputs[formula.base ?? ""] ?? 0) || 0;
  const raw = base * (1 + (Number(formula.waste_pct) || 0) / 100);
  const qty = Math.ceil(raw / (Number(formula.divide_by) || 1));
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
