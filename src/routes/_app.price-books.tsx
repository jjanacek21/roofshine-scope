import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Upload, Layers, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SelectedMarketView } from "@/components/pricing/SelectedMarketView";

export const Route = createFileRoute("/_app/price-books")({
  component: PricingPage,
});

type PriceBook = {
  id: string;
  name: string;
  jurisdiction: string | null;
  zip_codes: string[] | null;
  effective_month: string | null;
  item_count: number;
  is_active: boolean;
  created_at: string;
  source_file_url: string | null;
  pricing_type: string | null;
  is_default: boolean;
  company_id: string | null;
};


type TabKey = "insurance" | "retail";

function PricingPage() {
  const [tab, setTab] = useState<TabKey>("insurance");
  const matchRoute = useMatchRoute();
  const isChild = !matchRoute({ to: "/price-books", fuzzy: false });
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;
  const isAdmin = profile?.role === "owner" || profile?.role === "admin" || profile?.role === "super_admin";

  const { data: books = [] } = useQuery({
    queryKey: ["price-books"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name, jurisdiction, zip_codes, effective_month, item_count, status, is_active, created_at, source_file_url, pricing_type, is_default, company_id")
        .order("is_default", { ascending: false })
        .order("effective_month", { ascending: false, nullsFirst: false });
      return (data ?? []) as PriceBook[];
    },
  });

  const retailBooks = books.filter((b) => b.pricing_type === "retail");

  if (isChild) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pricing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your team uses the prices from the market you select below. Retail pricing comes from master macros.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setTab("insurance")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "insurance"
              ? "border-[var(--brand)] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="h-4 w-4" /> Insurance Pricing
        </button>
        <button
          onClick={() => setTab("retail")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "retail"
              ? "border-[var(--brand)] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <DollarSign className="h-4 w-4" /> Retail Pricing
        </button>
      </div>

      {tab === "insurance" ? (
        companyId ? (
          <SelectedMarketView companyId={companyId} canEdit={isAdmin} />
        ) : (
          <p className="text-sm text-muted-foreground">Loading your company…</p>
        )
      ) : (
        <RetailTab books={retailBooks} />
      )}
    </div>
  );
}


/* ============ RETAIL TAB ============ */

type MacroRow = {
  id: string;
  name: string;
  description: string | null;
  trade: string | null;
  category: string | null;
  company_id: string | null;
  items?: { count: number }[];
};

function RetailTab({ books }: { books: PriceBook[] }) {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;
  const isAdmin = profile?.role === "owner" || profile?.role === "admin" || profile?.role === "super_admin";
  const [openMacroId, setOpenMacroId] = useState<string | null>(null);

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ["macros-retail"],
    queryFn: async () => {
      const { data } = await supabase
        .from("master_macros")
        .select("id, name, description, trade, category, company_id")
        .order("is_default", { ascending: false })
        .order("name");
      return (data ?? []) as MacroRow[];
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Retail pricing uses master macros — bundles of line items every company can adopt and price for themselves.
        </p>
        <Link
          to="/price-books/new"
          search={{ pricing_type: "retail" } as never}
          className="btn-chrome flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        >
          <Upload className="h-4 w-4" />
          Upload Retail Book
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Master Macros</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading macros…</p>
        ) : macros.length === 0 ? (
          <div
            className="rounded-xl border border-dashed p-8 text-center"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm text-muted-foreground">
              No master macros yet. {isAdmin ? "Create one in" : "Ask your admin to create some in"}{" "}
              <span className="font-semibold text-foreground">Admin → Master Macros</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {macros.map((m) => (
              <button
                key={m.id}
                onClick={() => setOpenMacroId(m.id)}
                className="rounded-xl border p-4 text-left transition hover:border-[var(--brand)] hover:bg-[var(--surface-hover)]"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                  {m.company_id === null && (
                    <span className="rounded-full border border-purple-500 px-2 py-0.5 text-[9px] font-bold uppercase text-purple-400">
                      Master
                    </span>
                  )}
                </div>
                {m.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.trade && (
                    <span className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {m.trade}
                    </span>
                  )}
                  {m.category && (
                    <span className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] text-muted-foreground">
                      {m.category}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] font-semibold text-[var(--brand)]">Set my prices →</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {books.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Retail Books</h2>
          <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 text-right font-semibold">Items</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-6 py-3 font-medium text-foreground">{b.name}</td>
                    <td className="px-6 py-3 text-right font-mono-num">{b.item_count}</td>
                    <td className="px-6 py-3">
                      <StatusBadge status={b.is_active ? "active" : "archived"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openMacroId && companyId && (
        <MacroPricingDrawer
          macroId={openMacroId}
          companyId={companyId}
          canEdit={isAdmin}
          onClose={() => setOpenMacroId(null)}
        />
      )}
    </div>
  );
}

function MacroPricingDrawer({
  macroId, companyId, canEdit, onClose,
}: { macroId: string; companyId: string; canEdit: boolean; onClose: () => void }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["macro-items-pricing", macroId, companyId],
    queryFn: async () => {
      const { data: macroItems } = await supabase
        .from("master_macro_items")
        .select("id, qty, unit, sort_order, line_item_master_id, line_item_master:line_item_master_id(id, code, name, unit, default_price)")
        .eq("macro_id", macroId)
        .order("sort_order");
      const { data: pricing } = await supabase
        .from("company_macro_pricing")
        .select("line_item_master_id, unit_price")
        .eq("company_id", companyId)
        .eq("macro_id", macroId);
      const priceMap = new Map((pricing ?? []).map((p) => [p.line_item_master_id, Number(p.unit_price)]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (macroItems ?? []).map((mi: any) => ({
        id: mi.id,
        line_item_master_id: mi.line_item_master_id,
        code: mi.line_item_master?.code ?? "",
        name: mi.line_item_master?.name ?? "",
        unit: mi.unit ?? mi.line_item_master?.unit ?? "EA",
        qty: Number(mi.qty),
        default_price: Number(mi.line_item_master?.default_price ?? 0),
        my_price: priceMap.get(mi.line_item_master_id) ?? 0,
      }));
    },
  });

  const [edits, setEdits] = useState<Record<string, number>>({});

  async function saveAll() {
    const rows = items
      .filter((i) => edits[i.line_item_master_id] !== undefined)
      .map((i) => ({
        company_id: companyId,
        macro_id: macroId,
        line_item_master_id: i.line_item_master_id,
        unit_price: edits[i.line_item_master_id],
      }));
    if (rows.length === 0) {
      toast.info("No changes to save");
      return;
    }
    const { error } = await supabase
      .from("company_macro_pricing")
      .upsert(rows, { onConflict: "company_id,macro_id,line_item_master_id" });
    if (error) toast.error(error.message);
    else {
      toast.success(`Saved ${rows.length} prices`);
      setEdits({});
      onClose();
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-40 h-full w-full max-w-2xl overflow-y-auto border-l p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">My Prices</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Set your company's price for each line item in this macro. Leave blank to use the master default.
        </p>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-5 space-y-2">
            {items.map((i) => (
              <div key={i.id} className="grid grid-cols-[1fr_80px_120px] items-center gap-3 rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-xs font-mono-num text-muted-foreground">{i.code}</p>
                  <p className="text-sm font-medium text-foreground">{i.name}</p>
                  <p className="text-[10px] text-muted-foreground">Qty: {i.qty} {i.unit} · Default: ${i.default_price.toFixed(2)}</p>
                </div>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={i.my_price || ""}
                  placeholder={i.default_price.toFixed(2)}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setEdits((prev) => ({ ...prev, [i.line_item_master_id]: isNaN(v) ? 0 : v }));
                  }}
                  className="h-9 rounded border bg-[var(--surface-elevated)] px-2 text-right font-mono-num text-sm disabled:opacity-50"
                  style={{ borderColor: "var(--border)" }}
                />
                <span className="text-right text-xs text-muted-foreground">$/{i.unit}</span>
              </div>
            ))}
          </div>
        )}

        {canEdit && items.length > 0 && (
          <button onClick={saveAll} className="btn-brand mt-6 h-10 w-full rounded-md text-sm font-semibold">
            Save my prices
          </button>
        )}
      </div>
    </>
  );
}
