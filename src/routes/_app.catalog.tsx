import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { TRADES } from "@/lib/trades";
import { Upload, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const [tradeFilter, setTradeFilter] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalog", tradeFilter],
    queryFn: async () => {
      let q = supabase
        .from("line_item_master")
        .select("id, code, name, trade, category, unit, waste_pct, default_price, status")
        .order("code");
      if (tradeFilter !== "all") q = q.eq("trade", tradeFilter as never);
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Master price list across all trades.
          </p>
        </div>
        <button
          onClick={() => toast.info("Xactimate importer coming in next build")}
          className="btn-chrome flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        >
          <Upload className="h-4 w-4" />
          Import
        </button>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <Filter className="h-4 w-4 text-muted-foreground" />
        <button
          onClick={() => setTradeFilter("all")}
          className="rounded-md px-3 py-1 text-xs font-medium"
          style={
            tradeFilter === "all"
              ? { background: "var(--gradient-brand-soft)", color: "var(--brand)" }
              : { color: "var(--text-muted)" }
          }
        >
          All
        </button>
        {TRADES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTradeFilter(t.value)}
            className="rounded-md px-3 py-1 text-xs font-medium"
            style={
              tradeFilter === t.value
                ? { backgroundColor: `${t.color}1f`, color: t.color }
                : { color: "var(--text-muted)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            No catalog items yet. Import an Xactimate book or add items manually.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-semibold">Code</th>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Trade</th>
                <th className="px-6 py-3 font-semibold">Category</th>
                <th className="px-6 py-3 font-semibold">Unit</th>
                <th className="px-6 py-3 text-right font-semibold">Waste %</th>
                <th className="px-6 py-3 text-right font-semibold">Price</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr
                  key={i.id}
                  className="border-t hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-6 py-3 font-mono-num text-muted-foreground">{i.code}</td>
                  <td className="px-6 py-3 font-medium text-foreground">{i.name}</td>
                  <td className="px-6 py-3"><TradeBadge trade={i.trade} /></td>
                  <td className="px-6 py-3 text-muted-foreground">{i.category ?? "—"}</td>
                  <td className="px-6 py-3 font-mono-num text-muted-foreground">{i.unit}</td>
                  <td className="px-6 py-3 text-right font-mono-num text-muted-foreground">{Number(i.waste_pct)}%</td>
                  <td className="px-6 py-3 text-right font-mono-num font-semibold text-foreground">
                    ${Number(i.default_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
