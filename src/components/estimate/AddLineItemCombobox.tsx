import { useMemo, useState } from "react";
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

type RawRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  trade: string;
  category: string | null;
  domain: string | null;
  subgroup: string | null;
  default_price: number | null;
  remove_price: number | null;
  replace_price: number | null;
};

type EnrichedRow = RawRow & {
  effective_price: number;
  kind: "remove" | "replace" | "rr" | "other";
  base_key: string;
  base_label: string;
};

function coalescePrice(r: { default_price: number | null; remove_price: number | null; replace_price: number | null }) {
  const d = Number(r.default_price ?? 0);
  if (d > 0) return d;
  const rep = Number(r.replace_price ?? 0);
  if (rep > 0) return rep;
  const rem = Number(r.remove_price ?? 0);
  if (rem > 0) return rem;
  return 0;
}

function classify(name: string): { kind: EnrichedRow["kind"]; base: string } {
  const n = name.trim();
  const lower = n.toLowerCase();
  // R&R first
  let m = n.match(/^R&R\s+(.*)$/i);
  if (m) return { kind: "rr", base: m[1].trim() };
  m = n.match(/^Replace\s+(.*)$/i);
  if (m) return { kind: "replace", base: m[1].trim() };
  m = n.match(/^Remove\s+(.*)$/i);
  if (m) return { kind: "remove", base: m[1].trim() };
  // Tear off variants are removals
  m = n.match(/^Tear off,?\s+haul and dispose of\s+(.*)$/i);
  if (m) return { kind: "remove", base: m[1].trim() };
  m = n.match(/^Tear off\s+(.*)$/i);
  if (m) return { kind: "remove", base: m[1].trim() };
  // "Add. layer ... remove & disp. - X" — treat as removal of X
  m = n.match(/^Add\.?\s+layer of\s+(.*?),\s*remove\s*&\s*disp\.?\s*-\s*(.*)$/i);
  if (m) return { kind: "remove", base: `Add. layer ${m[1].trim()} - ${m[2].trim()}` };
  return { kind: "other", base: n };
  void lower;
}

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

  const { data: rows = [], isFetching } = useQuery<EnrichedRow[]>({
    queryKey: ["catalog-all-with-price-v2", priceBookId],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("line_item_master")
        .select(
          "id, code, name, description, unit, trade, category, default_price, remove_price, replace_price, domain, subgroup",
        )
        .eq("status", "active")
        .is("company_id", null)
        .order("code");
      if (!items?.length) return [];

      let priceMap: Record<string, number> = {};
      if (priceBookId) {
        const { data: prices } = await supabase
          .from("line_item_prices")
          .select("line_item_master_id, unit_price")
          .eq("price_book_id", priceBookId)
          .in("line_item_master_id", items.map((i) => i.id));
        priceMap = Object.fromEntries((prices ?? []).map((p) => [p.line_item_master_id, Number(p.unit_price)]));
      }

      return (items as RawRow[]).map((i) => {
        const { kind, base } = classify(i.name);
        const baseKey = [base.toLowerCase(), i.unit, i.trade, (i.subgroup ?? "").toLowerCase()].join("|");
        const override = priceMap[i.id];
        const effective = override != null && override > 0 ? override : coalescePrice(i);
        return {
          ...i,
          effective_price: effective,
          kind,
          base_key: baseKey,
          base_label: base,
        } satisfies EnrichedRow;
      });
    },
  });

  // Build display list: merge matching Remove + Replace into synthetic R&R.
  const { displayItems, pairMap } = useMemo(() => {
    const groups = new Map<string, EnrichedRow[]>();
    for (const r of rows) {
      if (!groups.has(r.base_key)) groups.set(r.base_key, []);
      groups.get(r.base_key)!.push(r);
    }

    const hidden = new Set<string>();
    const synthetic: CatalogItem[] = [];
    const pairs = new Map<string, { remove: EnrichedRow; replace: EnrichedRow }>();

    for (const group of groups.values()) {
      const hasRR = group.some((g) => g.kind === "rr");
      if (hasRR) continue;
      const removes = group.filter((g) => g.kind === "remove");
      const replaces = group.filter((g) => g.kind === "replace");
      if (removes.length === 1 && replaces.length === 1) {
        const rem = removes[0];
        const rep = replaces[0];
        const remPrice = Number(rem.remove_price ?? 0) > 0 ? Number(rem.remove_price) : rem.effective_price;
        const repPrice = Number(rep.replace_price ?? 0) > 0 ? Number(rep.replace_price) : rep.effective_price;
        const combined = remPrice + repPrice;
        const pairId = `pair:${rem.id}:${rep.id}`;
        hidden.add(rem.id);
        hidden.add(rep.id);
        pairs.set(pairId, { remove: rem, replace: rep });
        synthetic.push({
          id: pairId,
          code: `${rem.code}+${rep.code}`,
          name: `R&R ${rem.base_label}`,
          unit: rep.unit,
          domain: rep.domain,
          subgroup: rep.subgroup,
          default_price: combined,
          trade: rep.trade,
        });
      }
    }

    const passthrough: CatalogItem[] = rows
      .filter((r) => !hidden.has(r.id))
      .map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        unit: r.unit,
        domain: r.domain,
        subgroup: r.subgroup,
        default_price: r.effective_price,
        trade: r.trade,
      }));

    // Insert synthetic rows near their replace siblings — simplest: append, CatalogTree sorts visually by group.
    return { displayItems: [...passthrough, ...synthetic], pairMap: pairs };
  }, [rows]);

  function toResult(r: EnrichedRow, priceOverride?: number): CatalogResult {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      unit: r.unit,
      trade: r.trade,
      category: r.category,
      unit_price: priceOverride ?? r.effective_price,
    };
  }

  function handlePick(item: CatalogItem) {
    const pair = pairMap.get(item.id);
    if (pair) {
      const remPrice = Number(pair.remove.remove_price ?? 0) > 0 ? Number(pair.remove.remove_price) : pair.remove.effective_price;
      const repPrice = Number(pair.replace.replace_price ?? 0) > 0 ? Number(pair.replace.replace_price) : pair.replace.effective_price;
      onPick(toResult(pair.remove, remPrice));
      onPick(toResult(pair.replace, repPrice));
      return;
    }
    const full = rows.find((c) => c.id === item.id);
    if (!full) return;
    onPick(toResult(full));
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
            items={displayItems}
            search={q}
            mode="add"
            onAdd={handlePick}
          />
        )}
      </div>
    </div>
  );
}
