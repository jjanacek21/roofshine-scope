import { useMemo, useState } from "react";
import { Trash2, BookOpen, Sparkles, Zap, X } from "lucide-react";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { getTradeLabel } from "@/lib/trades";

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
}: {
  items: LineItem[];
  onPatch: (id: string, patch: Partial<LineItem>) => void;
  onDelete: (id: string) => void;
  onDeleteMany?: (ids: string[]) => void;
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

  const groups = useMemo(() => {
    const byTrade = new Map<string, LineItem[]>();
    for (const item of items) {
      if (!byTrade.has(item.trade)) byTrade.set(item.trade, []);
      byTrade.get(item.trade)!.push(item);
    }
    return Array.from(byTrade.entries()).sort((a, b) =>
      getTradeLabel(a[0]).localeCompare(getTradeLabel(b[0])),
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

  return (
    <div className="space-y-5">
      {groups.map(([trade, tradeItems]) => (
        <div key={trade} className="space-y-2">
          <div className="flex items-center gap-2">
            <TradeBadge trade={trade} size="md" />
            <span className="text-[11px] text-muted-foreground">{tradeItems.length} items</span>
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
                  <th className="w-8 px-3 py-2 text-left"></th>
                  <th className="w-20 px-2 py-2 text-left">Code</th>
                  <th className="px-2 py-2 text-left">Description</th>
                  <th className="w-20 px-2 py-2 text-right">Qty</th>
                  <th className="w-16 px-2 py-2 text-left">Unit</th>
                  <th className="w-24 px-2 py-2 text-right">Price</th>
                  <th className="w-24 px-2 py-2 text-right">Total</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {tradeItems.map((item) => {
                  const source = inferSource(item);
                  const Icon = SOURCE_META[source].icon;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[var(--bg-hover)]"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      <td className="px-3 py-2">
                        <Icon
                          className="h-3.5 w-3.5"
                          style={{ color: SOURCE_META[source].color }}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <span className="font-mono-num text-[11px] text-muted-foreground">
                          {item.code ?? "—"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={item.name}
                          onChange={(e) => onPatch(item.id, { name: e.target.value })}
                          className="w-full bg-transparent text-foreground outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <NumberInput
                          value={item.qty}
                          onChange={(v) => onPatch(item.id, { qty: v })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={item.unit}
                          onChange={(e) =>
                            onPatch(item.id, { unit: e.target.value.toUpperCase() })
                          }
                          className="font-mono-num w-full bg-transparent text-[12px] text-muted-foreground outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <NumberInput
                          value={item.unit_price}
                          onChange={(v) => onPatch(item.id, { unit_price: v })}
                          prefix="$"
                        />
                      </td>
                      <td className="font-mono-num px-2 py-2 text-right font-bold text-[var(--brand)]">
                        ${(item.qty * item.unit_price).toFixed(2)}
                      </td>
                      <td className="px-2 py-2">
                        <DeleteButton onConfirm={() => onDelete(item.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
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
