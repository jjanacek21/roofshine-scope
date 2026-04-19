// Helpers for parsing Xactimate-style estimate files (PDF/CSV/XLS/XLSX).
// Tolerant header detection so real-world Xactimate exports (Selector/Activity/RCV/ACV/Qty/Total)
// import cleanly even when the header row isn't row 1 and across multiple sheets.
import type { Trade } from "@/lib/trades";
import * as XLSX from "xlsx";

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
  | "qty"
  | "line_total"
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
  if (!h) return "ignore";
  if (/^(CAT|CATEGORY|GROUP)$/.test(h)) return "category";
  if (/^(SEL|SELECTOR|CODE|ITEM\s*CODE|XACT.*CODE)$/.test(h)) return "code";
  if (/(DESCRIPTION|ACTIVITY|ITEM\s*NAME|^ITEM$|^NAME$|LINE\s*ITEM)/.test(h)) return "name";
  if (/^(UNIT|U\/M|UOM|MEASURE)$/.test(h)) return "unit";
  if (/MATERIAL\s*COST/.test(h)) return "material_cost";
  if (/LABOR\s*COST/.test(h)) return "labor_cost";
  if (/(EQUIPMENT|EQP)\s*COST/.test(h)) return "equipment_cost";
  if (/(MISC|TAX|PERMIT|FEE|DUMP)/.test(h)) return "misc_cost";
  if (/(OVERHEAD|^OH\s*%|OH%)/.test(h)) return "overhead_pct_val";
  if (/^(QTY|QUANTITY)$/.test(h)) return "qty";
  if (/^(RCV|REPLACEMENT|TOTAL|EXTENDED|EXT\s*PRICE|LINE\s*TOTAL|AMOUNT)$/.test(h)) return "line_total";
  if (/^ACV$/.test(h)) return "line_total"; // ACV is a total too
  if (/(UNIT\s*PRICE|^PRICE$|UNIT\s*COST|RATE|USD)/.test(h)) return "unit_price";
  if (/^(LAB|LABOR)\s*%?$/.test(h)) return "labor_pct";
  if (/^(MAT|MATERIAL)\s*%?$/.test(h)) return "material_pct";
  if (/^(EQU|EQP|EQUIPMENT)\s*%?$/.test(h)) return "equipment_pct";
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

/* ======================================================================
   Tolerant spreadsheet extractor
   ====================================================================== */

export interface ExtractResult {
  headers: string[];
  rows: Record<string, unknown>[];
  mapping: ColumnRole[];
  sheetName: string;
  headerRowIndex: number; // 0-based
}

const REQUIRED_FOR_VALIDITY: ColumnRole[] = ["code", "name"];
// At least one of these gives us a price
const PRICEISH_ROLES: ColumnRole[] = ["unit_price", "line_total", "material_cost", "labor_cost", "equipment_cost"];

function scoreMapping(mapping: ColumnRole[]): number {
  // Higher score = better header row.
  let score = 0;
  const set = new Set(mapping);
  for (const r of REQUIRED_FOR_VALIDITY) if (set.has(r)) score += 5;
  if (PRICEISH_ROLES.some((r) => set.has(r))) score += 4;
  if (set.has("qty") && set.has("line_total")) score += 2;
  if (set.has("unit")) score += 1;
  if (set.has("category")) score += 1;
  // Penalize tons of "ignore" relative to mapped
  const mapped = mapping.filter((m) => m !== "ignore").length;
  score += Math.min(mapped, 6);
  return score;
}

/**
 * Find the most likely header row in a sheet by scanning first ~25 rows.
 * Returns the row index (0-based) and the resulting mapping.
 */
function detectHeaderRow(matrix: unknown[][]): { headerRowIndex: number; headers: string[]; mapping: ColumnRole[] } | null {
  const limit = Math.min(matrix.length, 25);
  let best: { idx: number; headers: string[]; mapping: ColumnRole[]; score: number } | null = null;
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    if (row.length < 2) continue;
    // Treat each cell as header text candidate
    const headers = row.map((c, j) => {
      const txt = (c ?? "").toString().trim();
      return txt || `Column ${j + 1}`;
    });
    const mapping = headers.map(autoMapHeader);
    if (!mapping.includes("code") && !mapping.includes("name")) continue;
    const score = scoreMapping(mapping);
    if (!best || score > best.score) best = { idx: i, headers, mapping, score };
  }
  return best ? { headerRowIndex: best.idx, headers: best.headers, mapping: best.mapping } : null;
}

function rowsBelowHeader(matrix: unknown[][], headers: string[], headerRowIndex: number): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    if (row.every((c) => c == null || c === "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => { obj[h] = row[j] ?? null; });
    out.push(obj);
  }
  return out;
}

/**
 * Parse an arbitrary spreadsheet (xlsx/xls/csv) buffer into normalized rows.
 * Scans every sheet, scores each one, returns the best.
 */
export function extractEstimateFromSpreadsheet(buf: ArrayBuffer): ExtractResult {
  const wb = XLSX.read(buf, { type: "array" });
  let best: (ExtractResult & { score: number }) | null = null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false });
    if (!matrix || matrix.length === 0) continue;
    const detected = detectHeaderRow(matrix);
    if (!detected) continue;
    const rows = rowsBelowHeader(matrix, detected.headers, detected.headerRowIndex);
    if (rows.length === 0) continue;
    const score = scoreMapping(detected.mapping) + Math.min(rows.length, 50) / 10;
    if (!best || score > best.score) {
      best = {
        headers: detected.headers,
        rows,
        mapping: detected.mapping,
        sheetName,
        headerRowIndex: detected.headerRowIndex,
        score,
      };
    }
  }

  if (best) {
    const { score: _omit, ...rest } = best;
    void _omit;
    return rest;
  }

  // Fallback: behave like the old parser on the first sheet.
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null }) : [];
  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  return {
    headers,
    rows: json,
    mapping: headers.map(autoMapHeader),
    sheetName: sheetName ?? "Sheet1",
    headerRowIndex: 0,
  };
}
