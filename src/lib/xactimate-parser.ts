// Helpers for parsing Xactimate-style catalog exports.
// Phase A: just the trade detector + column header heuristics.
// Phase B will use these in the upload wizard.
import type { Trade } from "@/lib/trades";

const XACTIMATE_CAT_TO_TRADE: Record<string, Trade> = {
  RFG: "roofing", RFC: "roofing",
  SDG: "exterior", STU: "exterior", SFF: "exterior",
  GUT: "exterior", FNC: "exterior", LND: "exterior", CON: "exterior",
  WDW: "windows", WDO: "windows", DOR: "windows",
  DRY: "interior", FLR: "interior", PNL: "interior",
  CAB: "interior", CNT: "interior", TRM: "interior",
  INS: "interior", TIL: "interior", PNT: "interior",
  HVC: "hvac", HEA: "hvac",
  PLM: "plumbing", FIX: "plumbing", WTH: "plumbing",
  ELE: "electrical", LIT: "electrical",
  WTR: "mitigation", MLD: "mitigation", CLN: "mitigation", DMO: "mitigation",
};

export function detectTradeFromCode(code: string): Trade | null {
  if (!code) return null;
  const prefix = code.trim().toUpperCase().split(/[\s-]/)[0].slice(0, 3);
  return XACTIMATE_CAT_TO_TRADE[prefix] ?? null;
}

export type ColumnRole =
  | "ignore"
  | "code"
  | "name"
  | "unit"
  | "unit_price"
  | "category"
  | "labor_pct"
  | "material_pct"
  | "equipment_pct"
  // Retail cost-build columns (true cost components)
  | "material_cost"
  | "labor_cost"
  | "equipment_cost"
  | "misc_cost"
  | "overhead_pct_val";

export function autoMapHeader(header: string): ColumnRole {
  const h = (header ?? "").toString().trim().toUpperCase();
  if (/^(CAT|CATEGORY)$/.test(h)) return "category";
  if (/^(SEL|SELECTOR|CODE)$/.test(h)) return "code";
  if (/(DESCRIPTION|ITEM|NAME)/.test(h)) return "name";
  if (/^(UNIT|U\/M|MEASURE)$/.test(h)) return "unit";
  if (/MATERIAL\s*COST/.test(h)) return "material_cost";
  if (/LABOR\s*COST/.test(h)) return "labor_cost";
  if (/(EQUIPMENT|EQP)\s*COST/.test(h)) return "equipment_cost";
  if (/(MISC|TAX|PERMIT|FEE|DUMP)/.test(h)) return "misc_cost";
  if (/(OVERHEAD|OH\s*%|OH%)/.test(h)) return "overhead_pct_val";
  if (/(UNIT PRICE|RETAIL|PRICE|USD)/.test(h)) return "unit_price";
  if (/^(LAB|LABOR)/.test(h)) return "labor_pct";
  if (/^(MAT|MATERIAL)/.test(h)) return "material_pct";
  if (/^(EQU|EQP|EQUIPMENT)/.test(h)) return "equipment_pct";
  return "ignore";
}

export function detectColumnMapping(headers: string[]): ColumnRole[] {
  return headers.map((h) => autoMapHeader(h));
}

export const UNIT_OPTIONS = ["SQ", "LF", "EA", "HR", "SF", "ROLL", "CY", "TON", "GAL", "DAY", "BDL", "BOX"] as const;

export const JURISDICTION_OPTIONS = [
  "Miami-Dade", "Broward", "Palm Beach", "Martin", "St. Lucie",
  "Pinellas", "Hillsborough", "Orange", "Lee", "Collier", "Other",
] as const;
