import { useMemo } from "react";
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
}

export interface MatchResult {
  toUpdate: Array<{ existing: ExistingItem; row: NormalizedRow; oldPrice: number | null }>;
  toCreate: NormalizedRow[];
  ignored: Array<{ row: Record<string, unknown>; reason: string }>;
}

export function normalizeRows(parsed: ParsedFile): { valid: NormalizedRow[]; ignored: MatchResult["ignored"] } {
  const valid: NormalizedRow[] = [];
  const ignored: MatchResult["ignored"] = [];
  const map = parsed.mapping;
  const headers = parsed.headers;
  const idx = (role: string) => map.findIndex((m) => m === role);
  const codeI = idx("code"), nameI = idx("name"), unitI = idx("unit"), priceI = idx("unit_price");
  const catI = idx("category"), labI = idx("labor_pct"), matI = idx("material_pct"), eqI = idx("equipment_pct");

  for (const row of parsed.rows) {
    const code = codeI >= 0 ? String(row[headers[codeI]] ?? "").trim() : "";
    const name = nameI >= 0 ? String(row[headers[nameI]] ?? "").trim() : "";
    const priceRaw = priceI >= 0 ? row[headers[priceI]] : null;
    const price = typeof priceRaw === "number" ? priceRaw : Number(String(priceRaw ?? "").replace(/[$,]/g, ""));
    if (!code || !name || !isFinite(price)) {
      ignored.push({ row, reason: !code ? "Missing code" : !name ? "Missing name" : "Invalid price" });
      continue;
    }
    valid.push({
      code,
      name,
      unit: unitI >= 0 ? String(row[headers[unitI]] ?? "EA").trim().toUpperCase() : "EA",
      unit_price: price,
      category: catI >= 0 ? (String(row[headers[catI]] ?? "").trim() || null) : null,
      trade: detectTradeFromCode(code) ?? "exterior",
      labor_pct: labI >= 0 ? Number(row[headers[labI]]) || null : null,
      material_pct: matI >= 0 ? Number(row[headers[matI]]) || null : null,
      equipment_pct: eqI >= 0 ? Number(row[headers[eqI]]) || null : null,
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
}

export function MatchConfirmStep({ parsed, existing, activeTab, onTabChange, onChange }: Props) {
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

  // Notify parent of normalized results so it can use on confirm
  useMemo(() => onChange([...result.toUpdate.map((u) => u.row), ...result.toCreate]), [result, onChange]);

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
                <th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Trade</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {result.toCreate.map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-1.5 font-mono-num text-foreground">{r.code}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.name}</td>
                  <td className="px-3 py-1.5"><TradeBadge trade={r.trade} /></td>
                  <td className="px-3 py-1.5 font-mono-num text-muted-foreground">{r.unit}</td>
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
