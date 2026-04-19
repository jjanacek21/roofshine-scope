import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TradeBadge } from "@/components/brand/TradeBadge";

export type CatalogResult = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  trade: string;
  category: string | null;
  unit_price: number;
};

export function AddLineItemCombobox({
  priceBookId,
  onPick,
  onClose,
}: {
  priceBookId: string | null;
  onPick: (item: CatalogResult) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["catalog-search", priceBookId, debounced],
    queryFn: async () => {
      const query = supabase
        .from("line_item_master")
        .select("id, code, name, description, unit, trade, category, default_price")
        .eq("status", "active")
        .limit(25);
      if (debounced) {
        query.or(
          `name.ilike.%${debounced}%,code.ilike.%${debounced}%,description.ilike.%${debounced}%`,
        );
      }
      const { data: items } = await query;
      if (!items?.length) return [] as CatalogResult[];

      let priceMap: Record<string, number> = {};
      if (priceBookId) {
        const { data: prices } = await supabase
          .from("line_item_prices")
          .select("line_item_master_id, unit_price")
          .eq("price_book_id", priceBookId)
          .in(
            "line_item_master_id",
            items.map((i) => i.id),
          );
        priceMap = Object.fromEntries(
          (prices ?? []).map((p) => [p.line_item_master_id, Number(p.unit_price)]),
        );
      }
      return items.map((i) => ({
        ...i,
        unit_price: priceMap[i.id] ?? Number(i.default_price ?? 0),
      })) as CatalogResult[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogResult[]>();
    for (const r of results) {
      const key = r.trade;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [results]);

  return (
    <div
      className="rounded-xl border shadow-lg"
      style={{ borderColor: "var(--border-bright)", backgroundColor: "var(--bg-elevated)" }}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--border)" }}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search catalog by name, code, description…"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isFetching && (
          <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">Searching…</div>
        )}
        {!isFetching && results.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
            No items found{debounced ? ` for "${debounced}"` : ""}.
          </div>
        )}
        {Array.from(grouped.entries()).map(([trade, items]) => (
          <div key={trade}>
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)" }}
            >
              <TradeBadge trade={trade} />
            </div>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onPick(item)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span
                  className="font-mono-num shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-dim)",
                  }}
                >
                  {item.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-foreground">{item.name}</div>
                  {item.category && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {item.category}
                    </div>
                  )}
                </div>
                <div className="font-mono-num shrink-0 text-right">
                  <div className="text-[13px] font-semibold text-foreground">
                    ${item.unit_price.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">/ {item.unit}</div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
