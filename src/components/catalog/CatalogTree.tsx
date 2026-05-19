// Reusable catalog browser: Trade → Subgroup → Line Items.
// Used by both the macro builder (with checkboxes) and the estimate picker.
import { useMemo, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRADES, getTradeColor, getTradeLabel } from "@/lib/trades";

export type CatalogItem = {
  id: string;
  code: string;
  name: string;
  unit: string;
  domain: string | null;
  subgroup: string | null;
  default_price: number;
  trade: string;
};

type Mode = "checkbox" | "add";

export function CatalogTree({
  items,
  search,
  selectedIds,
  onToggle,
  onAdd,
  mode,
}: {
  items: CatalogItem[];
  search: string;
  selectedIds?: Set<string>;
  onToggle?: (item: CatalogItem) => void;
  onAdd?: (item: CatalogItem) => void;
  mode: Mode;
}) {
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set());
  const [openSubgroups, setOpenSubgroups] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.code.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        (i.subgroup ?? "").toLowerCase().includes(q) ||
        getTradeLabel(i.trade ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  // Group by trade -> subgroup
  const tree = useMemo(() => {
    const map = new Map<string, Map<string, CatalogItem[]>>();
    for (const i of filtered) {
      const t = i.trade || "other";
      const s = i.subgroup?.trim() || "Other";
      if (!map.has(t)) map.set(t, new Map());
      const sub = map.get(t)!;
      if (!sub.has(s)) sub.set(s, []);
      sub.get(s)!.push(i);
    }
    return map;
  }, [filtered]);

  // Render trades in canonical order, then any extras alphabetically.
  const orderedTrades = useMemo(() => {
    const present = Array.from(tree.keys());
    const canonical = TRADES.map((t) => t.value).filter((v) => present.includes(v));
    const extras = present.filter((p) => !canonical.includes(p as typeof canonical[number])).sort();
    return [...canonical, ...extras];
  }, [tree]);

  const isSearching = search.trim().length > 0;

  function toggleDomain(d: string) {
    const next = new Set(openDomains);
    if (next.has(d)) next.delete(d); else next.add(d);
    setOpenDomains(next);
  }
  function toggleSubgroup(key: string) {
    const next = new Set(openSubgroups);
    if (next.has(key)) next.delete(key); else next.add(key);
    setOpenSubgroups(next);
  }

  function selectAllInSubgroup(items: CatalogItem[]) {
    if (!onToggle) return;
    const allSelected = items.every((i) => selectedIds?.has(i.id));
    for (const i of items) {
      if (allSelected ? selectedIds?.has(i.id) : !selectedIds?.has(i.id)) {
        onToggle(i);
      }
    }
  }

  if (filtered.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">
        No items match.
      </div>
    );
  }

  return (
    <div className="text-sm">
      {orderedTrades.map((trade) => {
        const subgroups = tree.get(trade)!;
        const dOpen = isSearching || openDomains.has(trade);
        const totalInDomain = Array.from(subgroups.values()).reduce((a, b) => a + b.length, 0);
        const color = getTradeColor(trade);
        const label = getTradeLabel(trade);
        return (
          <div key={trade} className="border-b" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => toggleDomain(trade)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold hover:bg-[var(--surface-hover)]"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", dOpen && "rotate-90")} />
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="flex-1">{label}</span>
              <span className="font-mono-num text-[11px] text-muted-foreground">{totalInDomain}</span>
            </button>
            {dOpen && (
              <div>
                {Array.from(subgroups.entries()).sort().map(([sub, subItems]) => {
                  const key = `${trade}::${sub}`;
                  const sOpen = isSearching || openSubgroups.has(key);
                  const allSel = mode === "checkbox" && subItems.every((i) => selectedIds?.has(i.id));
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2 bg-[var(--bg-card)] pl-7 pr-3 py-1.5">
                        <button
                          onClick={() => toggleSubgroup(key)}
                          className="flex flex-1 items-center gap-2 text-left text-[13px] hover:text-foreground"
                        >
                          <ChevronRight className={cn("h-3 w-3 transition-transform text-muted-foreground", sOpen && "rotate-90")} />
                          <span className="flex-1 text-muted-foreground">{sub}</span>
                          <span className="font-mono-num text-[10px] text-muted-foreground">{subItems.length}</span>
                        </button>
                        {mode === "checkbox" && (
                          <button
                            onClick={() => selectAllInSubgroup(subItems)}
                            className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                            style={{ borderColor: "var(--border)" }}
                          >
                            {allSel ? "Clear" : "All"}
                          </button>
                        )}
                      </div>
                      {sOpen && subItems.map((item) => {
                        const checked = selectedIds?.has(item.id) ?? false;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 pl-12 pr-3 py-1.5 hover:bg-[var(--surface-hover)]",
                              checked && "bg-[var(--brand)]/10",
                            )}
                          >
                            {mode === "checkbox" && (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggle?.(item)}
                                className="h-4 w-4"
                              />
                            )}
                            <span
                              className="font-mono-num shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
                            >
                              {item.code}
                            </span>
                            <span className="flex-1 truncate text-[13px]">{item.name}</span>
                            <span className="font-mono-num text-[11px] text-muted-foreground">
                              ${Number(item.default_price).toFixed(2)}/{item.unit}
                            </span>
                            {mode === "add" && (
                              <button
                                onClick={() => onAdd?.(item)}
                                className="rounded p-1 text-muted-foreground hover:bg-[var(--brand)]/15 hover:text-[var(--brand)]"
                                aria-label="Add"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
