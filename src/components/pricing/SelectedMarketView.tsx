// Company-facing single-market view for the Pricing page.
// Shows the company's currently-selected market (price book) and its line items
// grouped by trade → subgroup. Admins can switch markets.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, MapPin, Pencil, Search, Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMarketsPublic } from "@/lib/markets.functions";
import { TRADES, getTradeColor, getTradeLabel, type Trade } from "@/lib/trades";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Market = { id: string; name: string; region_name: string | null; jurisdiction: string | null; item_count: number };

type PriceRow = {
  unit_price: number;
  remove_price: number;
  line_item_master: {
    id: string;
    code: string;
    name: string;
    unit: string;
    trade: string;
    subgroup: string | null;
  } | null;
};

const UNCATEGORIZED = "Uncategorized";

export function SelectedMarketView({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const fetchMarkets = useServerFn(listMarketsPublic);

  // Current company's chosen market
  const { data: company } = useQuery({
    queryKey: ["company-default-market", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, default_market_id")
        .eq("id", companyId)
        .maybeSingle();
      return data;
    },
  });

  const { data: marketsData } = useQuery({
    queryKey: ["public-markets"],
    queryFn: () => fetchMarkets(),
  });
  const markets: Market[] = marketsData?.markets ?? [];
  const selectedId = company?.default_market_id ?? null;
  const selected = markets.find((m) => m.id === selectedId) ?? null;

  const setMarket = useMutation({
    mutationFn: async (marketId: string) => {
      const { error } = await supabase
        .from("companies")
        .update({ default_market_id: marketId })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Market updated");
      qc.invalidateQueries({ queryKey: ["company-default-market", companyId] });
      qc.invalidateQueries({ queryKey: ["market-items"] });
      setPickerOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pickerOpen, setPickerOpen] = useState(false);

  if (!selected) {
    return (
      <>
        <div
          className="rounded-xl border border-dashed p-10 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold text-foreground">No market selected</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit
              ? "Choose which market's pricing your team will use for estimates."
              : "Ask an admin to choose a market for your company."}
          </p>
          {canEdit && (
            <Button onClick={() => setPickerOpen(true)} className="mt-4">
              Choose a market
            </Button>
          )}
        </div>
        <MarketPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          markets={markets}
          selectedId={selectedId}
          onPick={(id) => setMarket.mutate(id)}
          saving={setMarket.isPending}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <SelectedMarketHeader
        market={selected}
        canEdit={canEdit}
        onChange={() => setPickerOpen(true)}
      />
      <MarketItemsTable marketId={selected.id} />
      <MarketPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        markets={markets}
        selectedId={selectedId}
        onPick={(id) => setMarket.mutate(id)}
        saving={setMarket.isPending}
      />
    </div>
  );
}

function SelectedMarketHeader({
  market,
  canEdit,
  onChange,
}: {
  market: Market;
  canEdit: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--surface-elevated)" }}
        >
          <Library className="h-6 w-6 text-[var(--brand)]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">{market.region_name || market.name}</h2>
            <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Active
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {market.jurisdiction ?? "—"} · {Number(market.item_count).toLocaleString()} line items
          </p>
        </div>
      </div>
      {canEdit && (
        <Button variant="outline" size="sm" onClick={onChange} className="gap-2">
          <Pencil className="h-4 w-4" /> Change market
        </Button>
      )}
    </div>
  );
}

function MarketPickerDialog({
  open,
  onOpenChange,
  markets,
  selectedId,
  onPick,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  markets: Market[];
  selectedId: string | null;
  onPick: (id: string) => void;
  saving: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(selectedId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose your market</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Estimates created by your team will use prices from the market you select.
        </p>
        <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
          {markets.length === 0 && (
            <p className="text-sm text-muted-foreground">No markets are available yet.</p>
          )}
          {markets.map((m) => {
            const isPicked = picked === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setPicked(m.id)}
                className="flex w-full items-center justify-between rounded-md border p-3 text-left transition hover:border-[var(--brand)]"
                style={{
                  borderColor: isPicked ? "var(--brand)" : "var(--border)",
                  backgroundColor: isPicked ? "var(--surface-elevated)" : "transparent",
                }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{m.region_name || m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.jurisdiction ?? "—"} · {Number(m.item_count).toLocaleString()} items
                  </p>
                </div>
                {isPicked && (
                  <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!picked || saving} onClick={() => picked && onPick(picked)}>
            {saving ? "Saving…" : "Use this market"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarketItemsTable({ marketId }: { marketId: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["market-items", marketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("line_item_prices")
        .select(
          "unit_price, remove_price, line_item_master:line_item_master_id(id, code, name, unit, trade, subgroup)",
        )
        .eq("price_book_id", marketId)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as PriceRow[];
    },
  });

  const [search, setSearch] = useState("");
  const [openTrades, setOpenTrades] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ trade: string; subgroup: string } | null>(null);

  const tree = useMemo(() => {
    const m = new Map<string, Map<string, PriceRow[]>>();
    for (const row of rows) {
      const li = row.line_item_master;
      if (!li) continue;
      const trade = li.trade || "interior";
      const sub = (li.subgroup || "").trim() || UNCATEGORIZED;
      if (!m.has(trade)) m.set(trade, new Map());
      const sg = m.get(trade)!;
      if (!sg.has(sub)) sg.set(sub, []);
      sg.get(sub)!.push(row);
    }
    return m;
  }, [rows]);

  const orderedTrades = useMemo(() => {
    const known = TRADES.map((t) => t.value as string).filter((v) => tree.has(v));
    const extras = Array.from(tree.keys()).filter((v) => !known.includes(v));
    return [...known, ...extras];
  }, [tree]);

  const filteredItems = useMemo(() => {
    let list: PriceRow[] = [];
    if (selected) {
      list = tree.get(selected.trade)?.get(selected.subgroup) ?? [];
    } else {
      for (const sg of tree.values()) for (const arr of sg.values()) list.push(...arr);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const li = r.line_item_master;
        if (!li) return false;
        return (
          li.code.toLowerCase().includes(q) ||
          li.name.toLowerCase().includes(q) ||
          (li.subgroup ?? "").toLowerCase().includes(q) ||
          getTradeLabel(li.trade).toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [tree, selected, search]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading line items…</p>;
  }

  return (
    <div
      className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border lg:grid-cols-[300px_1fr]"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
    >
      {/* Trade tree */}
      <div
        className="max-h-[70vh] overflow-y-auto border-r p-3"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setSelected(null)}
          className="mb-2 w-full rounded px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wider hover:bg-[var(--surface-hover)]"
          style={{ color: selected ? "var(--muted-foreground)" : "var(--brand)" }}
        >
          All items ({rows.length.toLocaleString()})
        </button>
        {orderedTrades.map((trade) => {
          const sg = tree.get(trade)!;
          const isOpen = openTrades.has(trade);
          const total = Array.from(sg.values()).reduce((s, a) => s + a.length, 0);
          return (
            <div key={trade}>
              <button
                onClick={() => {
                  const n = new Set(openTrades);
                  n.has(trade) ? n.delete(trade) : n.add(trade);
                  setOpenTrades(n);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-hover)]"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: getTradeColor(trade) }}
                />
                <span className="flex-1 font-semibold text-foreground">{getTradeLabel(trade)}</span>
                <span className="font-mono-num text-[11px] text-muted-foreground">{total}</span>
              </button>
              {isOpen && (
                <div className="mb-1 ml-6 mt-0.5 space-y-0.5">
                  {Array.from(sg.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([sub, arr]) => {
                      const isSel = selected?.trade === trade && selected.subgroup === sub;
                      return (
                        <button
                          key={sub}
                          onClick={() => setSelected({ trade, subgroup: sub })}
                          className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-[var(--surface-hover)]"
                          style={{
                            color: isSel ? "var(--brand)" : "var(--foreground)",
                            backgroundColor: isSel ? "var(--surface-elevated)" : "transparent",
                          }}
                        >
                          <span className="truncate">{sub}</span>
                          <span className="font-mono-num text-[10px] text-muted-foreground">
                            {arr.length}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Items table */}
      <div className="flex max-h-[70vh] flex-col">
        <div className="border-b p-3" style={{ borderColor: "var(--border)" }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, subgroup, or trade…"
              className="h-9 w-full rounded-md border bg-[var(--surface-elevated)] pl-9 pr-3 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {filteredItems.length.toLocaleString()} items
            {selected ? ` · ${getTradeLabel(selected.trade)} → ${selected.subgroup}` : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead
              className="sticky top-0 z-10"
              style={{ backgroundColor: "var(--surface)" }}
            >
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Code</th>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Unit</th>
                <th className="px-4 py-2 text-right font-semibold">Remove</th>
                <th className="px-4 py-2 text-right font-semibold">Replace</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((r, i) => {
                const li = r.line_item_master!;
                return (
                  <tr
                    key={li.id + i}
                    className="border-t hover:bg-[var(--surface-hover)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-2 font-mono-num text-xs text-foreground">{li.code}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: getTradeColor(li.trade) }}
                        />
                        <span className="text-foreground">{li.name}</span>
                      </div>
                      {li.subgroup && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{li.subgroup}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{li.unit}</td>
                    <td className="px-4 py-2 text-right font-mono-num text-foreground">
                      ${Number(r.remove_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono-num text-foreground">
                      ${Number(r.unit_price).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No items match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
