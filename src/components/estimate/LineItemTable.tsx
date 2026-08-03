import { useMemo, useState } from "react";
import { Trash2, BookOpen, Sparkles, Zap, X } from "lucide-react";
import { DEFAULT_AREA, UNCATEGORIZED, lineTotal, lineTax } from "@/lib/estimate-document";

export type LineItem = {
  id: string;
  estimate_id: string;
  line_item_id: string | null;
  code: string | null;
  name: string;
  trade: string;
  unit: string;
  qty: number;
  unit_price: number;
  total: number;
  sort_order: number;
  source?: string | null;
  category?: string | null;
  subgroup?: string | null;
  remove_price?: number | null;
  replace_price?: number | null;
  note?: string | null;
  area?: string | null;
  depreciation_pct?: number | null;
  depreciation_amount?: number | null;
  depreciation_recoverable?: boolean | null;
  not_yet_incurred?: boolean | null;
};


type Source = "catalog" | "ai" | "rule" | "custom";

function inferSource(item: LineItem): Source {
  if (item.source === "ai_photo") return "ai";
  if (!item.line_item_id) return "custom";
  return "catalog";
}

const SOURCE_META: Record<Source, { icon: typeof BookOpen; label: string; color: string }> = {
  catalog: { icon: BookOpen, label: "Catalog", color: "var(--text-dim)" },
  ai: { icon: Sparkles, label: "AI Photo", color: "#a855f7" },
  rule: { icon: Zap, label: "Rule", color: "#eab308" },
  custom: { icon: BookOpen, label: "Custom", color: "var(--text-muted)" },
};

export function LineItemTable({
  items,
  onPatch,
  onDelete,
  onDeleteMany,
  taxPct = 0,
}: {
  items: LineItem[];
  onPatch: (id: string, patch: Partial<LineItem>) => void;
  onDelete: (id: string) => void;
  onDeleteMany?: (ids: string[]) => void;
  taxPct?: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = (ids: string[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  // Group by AREA → CATEGORY to match the printed estimate document.
  const groups = useMemo(() => {
    const byKey = new Map<string, { area: string; category: string; items: LineItem[] }>();
    for (const item of items) {
      const area = (item.area || DEFAULT_AREA).trim() || DEFAULT_AREA;
      const category = (item.category || UNCATEGORIZED).trim() || UNCATEGORIZED;
      const key = `${area}||${category}`;
      if (!byKey.has(key)) byKey.set(key, { area, category, items: [] });
      byKey.get(key)!.items.push(item);
    }
    return Array.from(byKey.values()).sort(
      (a, b) => a.area.localeCompare(b.area) || a.category.localeCompare(b.category),
    );
  }, [items]);


  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-[13px] text-muted-foreground">No line items yet.</p>
        <p className="text-[12px] text-muted-foreground">
          Add items from the catalog or create a custom item below.
        </p>
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-5">
      {selectedCount > 0 && onDeleteMany && (
        <div
          className="sticky top-2 z-10 flex items-center justify-between rounded-xl border px-4 py-2 shadow-sm"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-bold text-foreground">{selectedCount}</span>
            <span className="text-muted-foreground">item{selectedCount === 1 ? "" : "s"} selected</span>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-[var(--bg-hover)]"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
          <button
            onClick={() => {
              onDeleteMany(Array.from(selected));
              clearSelection();
            }}
            className="flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
          >
            <Trash2 className="h-3 w-3" /> Delete selected
          </button>
        </div>
      )}
      {groups.map((group) => {
        const groupIds = group.items.map((t) => t.id);
        const allSelected = groupIds.every((id) => selected.has(id));
        const someSelected = !allSelected && groupIds.some((id) => selected.has(id));
        const groupSubtotal = group.items.reduce((s, i) => s + lineTotal(i), 0);
        return (
        <div key={`${group.area}||${group.category}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "var(--bg-hover)", color: "var(--text)" }}>
              {group.area}
            </span>
            <span className="text-[12px] font-bold uppercase tracking-wider text-foreground">{group.category}</span>
            <span className="text-[11px] text-muted-foreground">{group.items.length} items</span>
            <span className="font-mono-num ml-auto text-[12px] font-bold text-[var(--brand)]">
              ${groupSubtotal.toFixed(2)}
            </span>
          </div>

          <div
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <th className="w-8 px-3 py-2 text-left">
                    {onDeleteMany && (
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected; }}
                        onChange={(e) => toggleAll(groupIds, e.target.checked)}
                        className="h-3.5 w-3.5 cursor-pointer"
                      />
                    )}
                  </th>
                  <th className="w-8 px-2 py-2 text-left"></th>
                  <th className="px-2 py-2 text-left">Description</th>
                  <th className="w-24 px-2 py-2 text-right">Qty</th>
                  <th className="w-14 px-2 py-2 text-left">Unit</th>
                  <th className="w-24 px-2 py-2 text-right">Remove</th>
                  <th className="w-24 px-2 py-2 text-right">Replace</th>
                  <th className="w-20 px-2 py-2 text-right">Tax</th>
                  <th className="w-16 px-2 py-2 text-right">Dep %</th>
                  <th className="w-10 px-2 py-2 text-center" title="Payment not yet incurred">NI</th>
                  <th className="w-24 px-2 py-2 text-right">Total</th>
                  <th className="w-10 px-2 py-2"></th>

                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => {
                  const source = inferSource(item);
                  const Icon = SOURCE_META[source].icon;
                  const isSelected = selected.has(item.id);
                  const rm = Number(item.remove_price ?? 0);
                  const rp = Number(item.replace_price ?? 0);
                  const split = rm > 0 || rp > 0;
                  const tax = lineTax(item, taxPct);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--bg-hover)]"
                      style={{ borderTop: "1px solid var(--border)", backgroundColor: isSelected ? "var(--bg-hover)" : undefined }}
                    >
                      <td className="px-3 py-2 align-top">
                        {onDeleteMany && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(item.id)}
                            className="h-3.5 w-3.5 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Icon
                          className="h-3.5 w-3.5"
                          style={{ color: SOURCE_META[source].color }}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={item.name}
                          onChange={(e) => onPatch(item.id, { name: e.target.value })}
                          className="w-full bg-transparent text-foreground outline-none"
                        />
                        <input
                          value={item.note ?? ""}
                          placeholder={item.code ? `${item.code} — add a note` : "Add a note"}
                          onChange={(e) => onPatch(item.id, { note: e.target.value })}
                          className="w-full bg-transparent text-[11px] text-muted-foreground outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <NumberInput
                          value={item.qty}
                          onChange={(v) => onPatch(item.id, { qty: v })}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          value={item.unit}
                          onChange={(e) =>
                            onPatch(item.id, { unit: e.target.value.toUpperCase() })
                          }
                          className="font-mono-num w-full bg-transparent text-[12px] text-muted-foreground outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <NumberInput
                          value={rm}
                          onChange={(v) => onPatch(item.id, { remove_price: v })}
                          prefix="$"
                        />
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <NumberInput
                          value={split ? rp : Number(item.unit_price ?? 0)}
                          onChange={(v) =>
                            onPatch(
                              item.id,
                              split ? { replace_price: v } : { unit_price: v },
                            )
                          }
                          prefix="$"
                        />
                      </td>
                      <td className="font-mono-num px-2 py-2 text-right align-top text-[12px] text-muted-foreground">
                        ${tax.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-right align-top">
                        <NumberInput
                          value={Number(item.depreciation_pct ?? 0)}
                          onChange={(v) => onPatch(item.id, { depreciation_pct: v })}
                        />
                      </td>
                      <td className="px-2 py-2 text-center align-top">
                        <input
                          type="checkbox"
                          title="Payment not yet incurred — excluded from totals"
                          checked={Boolean(item.not_yet_incurred)}
                          onChange={(e) => onPatch(item.id, { not_yet_incurred: e.target.checked })}
                          className="h-3.5 w-3.5 cursor-pointer"
                        />
                      </td>
                      <td
                        className="font-mono-num px-2 py-2 text-right align-top font-bold text-[var(--brand)]"
                        style={item.not_yet_incurred ? { textDecoration: "line-through", opacity: 0.6 } : undefined}
                      >
                        ${(lineTotal(item) + tax).toFixed(2)}
                      </td>

                      <td className="px-2 py-2 align-top">
                        <DeleteButton onConfirm={() => onDelete(item.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        );
      })}

    </div>
  );
}

function NumberInput({
  value,
  onChange,
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
}) {
  const [text, setText] = useState(String(value));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => setText(String(value))}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = Number(text.replace(/[^0-9.\-]/g, ""));
        if (!Number.isNaN(n)) onChange(n);
        else setText(String(value));
      }}
      className="font-mono-num w-full bg-transparent text-right text-foreground outline-none"
      placeholder={prefix ? `${prefix}0.00` : "0"}
    />
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <button
        onClick={onConfirm}
        onBlur={() => setConfirming(false)}
        className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
        style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
        autoFocus
      >
        Sure?
      </button>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md p-1 text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-[var(--danger)]"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
