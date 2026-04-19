import { useEffect, useMemo } from "react";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { detectTradeFromCode } from "@/lib/xactimate-parser";
import type { Trade } from "@/lib/trades";
import type { ParsedFile } from "./UploadParseStep";

export interface ExistingItem {
  id: string;
  code: string;
  name: string;
  current_price: number | null;
}

export interface NormalizedRow {
  code: string;
  name: string;
  unit: string;
  unit_price: number;
  category: string | null;
  trade: Trade;
  labor_pct: number | null;
  material_pct: number | null;
  equipment_pct: number | null;
  // Retail cost-build extras
  material_cost: number | null;
  labor_cost: number | null;
  equipment_cost: number | null;
  misc_cost: number | null;
  overhead_pct_val: number | null;
}

export interface MatchResult {
  toUpdate: Array<{ existing: ExistingItem; row: NormalizedRow; oldPrice: number | null }>;
  toCreate: NormalizedRow[];
  ignored: Array<{ row: Record<string, unknown>; reason: string }>;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,%]/g, ""));
  return isFinite(n) ? n : null;
}

export function normalizeRows(parsed: ParsedFile): { valid: NormalizedRow[]; ignored: MatchResult["ignored"] } {
  const valid: NormalizedRow[] = [];
  const ignored: MatchResult["ignored"] = [];
  const map = parsed.mapping;
  const headers = parsed.headers;
  const idx = (role: string) => map.findIndex((m) => m === role);
  const codeI = idx("code"), nameI = idx("name"), unitI = idx("unit"), priceI = idx("unit_price");
  const qtyI = idx("qty"), totalI = idx("line_total");
  const catI = idx("category"), labI = idx("labor_pct"), matI = idx("material_pct"), eqI = idx("equipment_pct");
  const matCostI = idx("material_cost"), labCostI = idx("labor_cost"), eqCostI = idx("equipment_cost");
  const miscI = idx("misc_cost"), ohI = idx("overhead_pct_val");

  for (const row of parsed.rows) {
    const code = codeI >= 0 ? String(row[headers[codeI]] ?? "").trim() : "";
    const name = nameI >= 0 ? String(row[headers[nameI]] ?? "").trim() : "";
    const matCost = matCostI >= 0 ? num(row[headers[matCostI]]) : null;
    const labCost = labCostI >= 0 ? num(row[headers[labCostI]]) : null;
    const eqCost = eqCostI >= 0 ? num(row[headers[eqCostI]]) : null;
    const miscCost = miscI >= 0 ? num(row[headers[miscI]]) : null;
    const ohPctVal = ohI >= 0 ? num(row[headers[ohI]]) : null;
    const qty = qtyI >= 0 ? num(row[headers[qtyI]]) : null;
    const lineTotal = totalI >= 0 ? num(row[headers[totalI]]) : null;

    let price = priceI >= 0 ? num(row[headers[priceI]]) : null;
    // Derive unit_price from cost components if not provided directly
    if (price == null && (matCost != null || labCost != null || eqCost != null || miscCost != null)) {
      const subtotal = (matCost ?? 0) + (labCost ?? 0) + (eqCost ?? 0) + (miscCost ?? 0);
      price = subtotal + (subtotal * (ohPctVal ?? 0)) / 100;
    }
    // Derive unit_price from qty + line_total if still missing
    if (price == null && qty != null && qty > 0 && lineTotal != null) {
      price = lineTotal / qty;
    }
    // Last resort: if we have line_total but no qty, treat as a 1-unit item
    if (price == null && lineTotal != null && qty == null) {
      price = lineTotal;
    }
    if (!code || !name || price == null || !isFinite(price)) {
      ignored.push({
        row,
        reason: !code ? "Missing code/selector"
          : !name ? "Missing description/activity"
          : "No usable price (need unit price, OR qty + total, OR cost components)",
      });
      continue;
    }
    valid.push({
      code,
      name,
      unit: unitI >= 0 ? String(row[headers[unitI]] ?? "EA").trim().toUpperCase() : "EA",
      unit_price: price,
      category: catI >= 0 ? (String(row[headers[catI]] ?? "").trim() || null) : null,
      trade: detectTradeFromCode(code) ?? "exterior",
      labor_pct: labI >= 0 ? num(row[headers[labI]]) : null,
      material_pct: matI >= 0 ? num(row[headers[matI]]) : null,
      equipment_pct: eqI >= 0 ? num(row[headers[eqI]]) : null,
      material_cost: matCost,
      labor_cost: labCost,
      equipment_cost: eqCost,
      misc_cost: miscCost,
      overhead_pct_val: ohPctVal,
    });
  }
  return { valid, ignored };
}

interface Props {
  parsed: ParsedFile;
  existing: ExistingItem[];
  activeTab: "update" | "new" | "ignored";
  onTabChange: (t: "update" | "new" | "ignored") => void;
  onChange: (newItems: NormalizedRow[]) => void;
  pricingType?: "insurance" | "retail";
}

export function MatchConfirmStep({ parsed, existing, activeTab, onTabChange, onChange, pricingType = "insurance" }: Props) {
  const result = useMemo<MatchResult>(() => {
    const { valid, ignored } = normalizeRows(parsed);
    const byCode = new Map(existing.map((e) => [e.code.toUpperCase(), e]));
    const toUpdate: MatchResult["toUpdate"] = [];
    const toCreate: NormalizedRow[] = [];
    for (const row of valid) {
      const match = byCode.get(row.code.toUpperCase());
      if (match) toUpdate.push({ existing: match, row, oldPrice: match.current_price });
      else toCreate.push(row);
    }
    return { toUpdate, toCreate, ignored };
  }, [parsed, existing]);

  // Notify parent of normalized results so it can use on confirm (effect, not memo)
  useEffect(() => {
    onChange([...result.toUpdate.map((u) => u.row), ...result.toCreate]);
  }, [result, onChange]);

  const showCostCols = pricingType === "retail" && result.toCreate.some(
    (r) => r.material_cost != null || r.labor_cost != null || r.equipment_cost != null || r.misc_cost != null,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border p-3 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <span className="font-mono-num text-foreground">{result.toUpdate.length}</span>
        <span className="text-muted-foreground">to update</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono-num text-foreground">{result.toCreate.length}</span>
        <span className="text-muted-foreground">new</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-mono-num text-foreground">{result.ignored.length}</span>
        <span className="text-muted-foreground">ignored</span>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {(["update", "new", "ignored"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`border-b-2 px-3 py-2 text-sm capitalize transition-colors ${
              activeTab === t ? "border-[var(--brand)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "update" ? `Will Update (${result.toUpdate.length})` : t === "new" ? `New Items (${result.toCreate.length})` : `Ignored (${result.ignored.length})`}
          </button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
        {activeTab === "update" && (
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: "var(--bg-card)" }}>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Old</th><th className="px-3 py-2 text-right">New</th><th className="px-3 py-2 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {result.toUpdate.map((u, i) => {
                const diff = u.oldPrice != null ? u.row.unit_price - u.oldPrice : null;
                return (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-1.5 font-mono-num text-foreground">{u.row.code}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{u.row.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono-num text-muted-foreground">{u.oldPrice != null ? `$${u.oldPrice.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono-num text-foreground">${u.row.unit_price.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-right font-mono-num" style={{ color: diff == null ? "var(--text-muted)" : diff >= 0 ? "var(--success)" : "var(--danger)" }}>
                      {diff == null ? "—" : `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {activeTab === "new" && (
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: "var(--bg-card)" }}>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Trade</th><th className="px-3 py-2">Unit</th>
                {showCostCols && <>
                  <th className="px-3 py-2 text-right">Mat</th>
                  <th className="px-3 py-2 text-right">Lab</th>
                  <th className="px-3 py-2 text-right">Eq</th>
                  <th className="px-3 py-2 text-right">Misc</th>
                  <th className="px-3 py-2 text-right">OH%</th>
                </>}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {result.toCreate.map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-1.5 font-mono-num text-foreground">{r.code}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.name}</td>
                  <td className="px-3 py-1.5"><TradeBadge trade={r.trade} /></td>
                  <td className="px-3 py-1.5 font-mono-num text-muted-foreground">{r.unit}</td>
                  {showCostCols && <>
                    <td className="px-3 py-1.5 text-right font-mono-num text-muted-foreground">{r.material_cost != null ? `$${r.material_cost.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono-num text-muted-foreground">{r.labor_cost != null ? `$${r.labor_cost.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono-num text-muted-foreground">{r.equipment_cost != null ? `$${r.equipment_cost.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono-num text-muted-foreground">{r.misc_cost != null ? `$${r.misc_cost.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono-num text-muted-foreground">{r.overhead_pct_val != null ? `${r.overhead_pct_val}%` : "—"}</td>
                  </>}
                  <td className="px-3 py-1.5 text-right font-mono-num text-foreground">${r.unit_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {activeTab === "ignored" && (
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: "var(--bg-card)" }}>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Reason</th><th className="px-3 py-2">Row preview</th>
              </tr>
            </thead>
            <tbody>
              {result.ignored.map((it, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-1.5 text-[var(--warning)]">{it.reason}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{JSON.stringify(it.row).slice(0, 120)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
