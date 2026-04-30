import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CatalogTree, type CatalogItem } from "@/components/catalog/CatalogTree";

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

  const { data: catalog = [], isFetching } = useQuery({
    queryKey: ["catalog-all-with-price", priceBookId],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("line_item_master")
        .select("id, code, name, description, unit, trade, category, default_price, domain, subgroup")
        .eq("status", "active")
        .is("company_id", null)
        .order("code");
      if (!items?.length) return [] as (CatalogItem & { description: string | null; category: string | null })[];

      let priceMap: Record<string, number> = {};
      if (priceBookId) {
        const { data: prices } = await supabase
          .from("line_item_prices")
          .select("line_item_master_id, unit_price")
          .eq("price_book_id", priceBookId)
          .in("line_item_master_id", items.map((i) => i.id));
        priceMap = Object.fromEntries((prices ?? []).map((p) => [p.line_item_master_id, Number(p.unit_price)]));
      }
      return items.map((i) => ({
        ...i,
        default_price: priceMap[i.id] ?? Number(i.default_price ?? 0),
      }));
    },
  });

  function handlePick(item: CatalogItem) {
    const full = catalog.find((c) => c.id === item.id);
    if (!full) return;
    onPick({
      id: full.id,
      code: full.code,
      name: full.name,
      description: full.description,
      unit: full.unit,
      trade: full.trade,
      category: full.category,
      unit_price: Number(full.default_price ?? 0),
    });
  }

  return (
    <div
      className="flex h-[480px] w-[640px] max-w-[90vw] flex-col rounded-xl border shadow-lg"
      style={{ borderColor: "var(--border-bright)", backgroundColor: "var(--bg-elevated)" }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by code, name, or sub-group… or browse below"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isFetching && (
          <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">Loading catalog…</div>
        )}
        {!isFetching && (
          <CatalogTree
            items={catalog}
            search={q}
            mode="add"
            onAdd={handlePick}
          />
        )}
      </div>
    </div>
  );
}
