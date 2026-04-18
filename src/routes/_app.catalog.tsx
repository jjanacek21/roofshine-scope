import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { TRADES, type Trade } from "@/lib/trades";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Plus, Search, Filter, X, History } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/catalog")({
  component: CatalogPage,
});

const UNITS = ["SQ", "LF", "EA", "HR", "SF", "ROLL", "CY", "TON", "GAL", "DAY", "BDL", "BOX"];

type LineItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  trade: Trade;
  category: string | null;
  unit: string;
  waste_pct: number;
  default_price: number;
  status: "active" | "inactive";
  tags: string[] | null;
};

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function CatalogPage() {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [tradeFilter, setTradeFilter] = useState<Trade[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{ open: boolean; item?: LineItem }>({ open: false });
  const [historyFor, setHistoryFor] = useState<LineItem | null>(null);
  const [confirmInactive, setConfirmInactive] = useState<LineItem | null>(null);

  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalog-all", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("line_item_master")
        .select("id, code, name, description, trade, category, unit, waste_pct, default_price, status, tags")
        .order("code");
      if (error) throw error;
      return (data ?? []) as LineItem[];
    },
  });

  // Active price book (for "Current Price" column) — most recent active.
  const { data: activeBook } = useQuery({
    queryKey: ["active-price-book", companyId],
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name")
        .eq("is_active", true)
        .order("effective_month", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: priceMap = {} } = useQuery({
    queryKey: ["active-prices", activeBook?.id],
    enabled: !!activeBook?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("line_item_prices")
        .select("line_item_master_id, unit_price")
        .eq("price_book_id", activeBook!.id);
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.line_item_master_id] = Number(r.unit_price);
      return map;
    },
  });

  const allCategories = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) if (i.category) s.add(i.category);
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return items.filter((i) => {
      if (activeOnly && i.status !== "active") return false;
      if (tradeFilter.length && !tradeFilter.includes(i.trade)) return false;
      if (categoryFilter.length && (!i.category || !categoryFilter.includes(i.category))) return false;
      if (q) {
        const hay = `${i.code} ${i.name} ${i.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, debouncedSearch, tradeFilter, categoryFilter, activeOnly]);

  const setStatusBulk = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "active" | "inactive" }) => {
      const { error } = await supabase
        .from("line_item_master")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`${v.ids.length} item${v.ids.length === 1 ? "" : "s"} marked ${v.status}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["catalog-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCSV() {
    const rows = items.filter((i) => selected.has(i.id));
    if (!rows.length) return;
    const header = ["code", "name", "trade", "category", "unit", "waste_pct", "default_price", "status"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [r.code, r.name, r.trade, r.category ?? "", r.unit, r.waste_pct, r.default_price, r.status]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `catalog-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Master price list across all trades.
            {activeBook && <> Prices from <span className="font-medium text-foreground">{activeBook.name}</span>.</>}
          </p>
        </div>
        <button
          onClick={() => setDrawer({ open: true })}
          className="btn-chrome flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          Add Line Item
        </button>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, name, description…"
            className="h-9 w-full rounded-md border bg-[var(--surface-elevated)] pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            style={{ borderColor: "var(--border)" }}
          />
        </div>

        <MultiPopover
          label={tradeFilter.length ? `Trades · ${tradeFilter.length}` : "All trades"}
          options={TRADES.map((t) => ({ value: t.value, label: t.label, color: t.color }))}
          selected={tradeFilter}
          onChange={(v) => setTradeFilter(v as Trade[])}
        />

        <MultiPopover
          label={categoryFilter.length ? `Categories · ${categoryFilter.length}` : "All categories"}
          options={allCategories.map((c) => ({ value: c, label: c }))}
          selected={categoryFilter}
          onChange={setCategoryFilter}
        />

        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          Active only
        </label>

        <span className="ml-auto font-mono-num text-xs text-muted-foreground">
          Showing {filtered.length} of {items.length}
        </span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3 rounded-lg border px-4 py-2.5"
          style={{
            borderColor: "var(--brand)",
            background: "color-mix(in oklab, var(--brand) 8%, transparent)",
          }}
        >
          <span className="text-sm font-semibold text-foreground">{selected.size} selected</span>
          <button
            onClick={() => setStatusBulk.mutate({ ids: [...selected], status: "active" })}
            className="rounded-md border px-3 py-1 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            Mark Active
          </button>
          <button
            onClick={() => setStatusBulk.mutate({ ids: [...selected], status: "inactive" })}
            className="rounded-md border px-3 py-1 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            Mark Inactive
          </button>
          <button
            onClick={exportCSV}
            className="rounded-md border px-3 py-1 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            Export Selected to CSV
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[var(--surface-elevated)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No line items yet. Upload a Xactimate export or add items manually.
            </p>
            <a
              href="/price-books"
              className="btn-brand mt-4 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
            >
              Upload Price Book
            </a>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            No items match your filters.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) filtered.forEach((i) => next.add(i.id));
                      else filtered.forEach((i) => next.delete(i.id));
                      setSelected(next);
                    }}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Trade</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Unit</th>
                <th className="px-4 py-3 text-right font-semibold">Waste %</th>
                <th className="px-4 py-3 text-right font-semibold">Current Price</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const currentPrice = priceMap[i.id] ?? Number(i.default_price);
                const isSel = selected.has(i.id);
                return (
                  <tr
                    key={i.id}
                    className="group border-t hover:bg-[var(--surface-hover)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => {
                          const next = new Set(selected);
                          if (isSel) next.delete(i.id);
                          else next.add(i.id);
                          setSelected(next);
                        }}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded font-mono-num text-[11px] font-semibold text-foreground"
                        style={{
                          background: "var(--surface-elevated)",
                          padding: "2px 6px",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {i.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{i.name}</div>
                      {i.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {i.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><TradeBadge trade={i.trade} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{i.category ?? "—"}</td>
                    <td className="px-4 py-3 font-mono-num text-muted-foreground">{i.unit}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-muted-foreground">
                      {Number(i.waste_pct)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num font-semibold text-foreground">
                      ${currentPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => setHistoryFor(i)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
                          aria-label="Price history"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDrawer({ open: true, item: i })}
                          className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
                        >
                          Edit
                        </button>
                        {i.status === "active" && (
                          <button
                            onClick={() => setConfirmInactive(i)}
                            className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {drawer.open && companyId && (
        <LineItemDrawer
          companyId={companyId}
          item={drawer.item}
          existingCategories={allCategories}
          onClose={() => setDrawer({ open: false })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["catalog-all"] });
            setDrawer({ open: false });
          }}
        />
      )}

      {historyFor && (
        <PriceHistoryModal item={historyFor} onClose={() => setHistoryFor(null)} />
      )}

      {confirmInactive && (
        <ConfirmDialog
          title="Mark item inactive?"
          message={`"${confirmInactive.name}" will be hidden from active filters but kept in the catalog.`}
          confirmLabel="Mark Inactive"
          onCancel={() => setConfirmInactive(null)}
          onConfirm={() => {
            setStatusBulk.mutate({ ids: [confirmInactive.id], status: "inactive" });
            setConfirmInactive(null);
          }}
        />
      )}
    </div>
  );
}

/* ----- multi-select popover ----- */
function MultiPopover({
  label, options, selected, onChange,
}: {
  label: string;
  options: { value: string; label: string; color?: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
        style={{ borderColor: "var(--border)" }}
      >
        <Filter className="h-3.5 w-3.5" />
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-1 w-64 rounded-lg border p-2 shadow-lg"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-elevated)" }}
          >
            {options.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">No options</p>
            ) : (
              <>
                <div className="max-h-64 overflow-y-auto">
                  {options.map((o) => {
                    const isSel = selected.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        onClick={() =>
                          onChange(isSel ? selected.filter((x) => x !== o.value) : [...selected, o.value])
                        }
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-[var(--surface-hover)]"
                      >
                        <input type="checkbox" readOnly checked={isSel} className="h-3.5 w-3.5 accent-[var(--brand)]" />
                        {o.color && <span className="h-2 w-2 rounded-sm" style={{ background: o.color }} />}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {selected.length > 0 && (
                  <button
                    onClick={() => onChange([])}
                    className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-[var(--surface-hover)]"
                  >
                    Clear all
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ----- add/edit drawer ----- */
function LineItemDrawer({
  companyId, item, existingCategories, onClose, onSaved,
}: {
  companyId: string;
  item?: LineItem;
  existingCategories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [trade, setTrade] = useState<Trade>(item?.trade ?? "roofing");
  const [category, setCategory] = useState(item?.category ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "EA");
  const [wastePct, setWastePct] = useState(String(item?.waste_pct ?? 0));
  const [defaultPrice, setDefaultPrice] = useState(String(item?.default_price ?? 0));
  const [tagsInput, setTagsInput] = useState((item?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    setSaving(true);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null,
        trade,
        category: category.trim() || null,
        unit,
        waste_pct: Number(wastePct) || 0,
        default_price: Number(defaultPrice) || 0,
        tags,
        company_id: companyId,
      };
      if (item) {
        const { error } = await supabase
          .from("line_item_master")
          .update(payload)
          .eq("id", item.id);
        if (error) throw error;
        toast.success("Item updated");
      } else {
        // unique check
        const { data: existing } = await supabase
          .from("line_item_master")
          .select("id")
          .eq("company_id", companyId)
          .eq("code", payload.code)
          .maybeSingle();
        if (existing) throw new Error(`Code "${payload.code}" already exists`);
        const { error } = await supabase.from("line_item_master").insert(payload);
        if (error) throw error;
        toast.success("Item created");
      }
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/50" onClick={onClose} />
      <div
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l shadow-2xl"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-bold text-foreground">{item ? "Edit Line Item" : "Add Line Item"}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <DrawerField label="Code *">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="drawer-input font-mono-num"
              placeholder="RFG-SHGL"
            />
          </DrawerField>
          <DrawerField label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} className="drawer-input" />
          </DrawerField>
          <DrawerField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="drawer-input resize-none"
            />
          </DrawerField>
          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Trade">
              <select value={trade} onChange={(e) => setTrade(e.target.value as Trade)} className="drawer-input">
                {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Unit">
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="drawer-input">
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </DrawerField>
          </div>
          <DrawerField label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="cat-suggestions"
              className="drawer-input"
            />
            <datalist id="cat-suggestions">
              {existingCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </DrawerField>
          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Waste %">
              <input
                type="number" min={0} max={100} value={wastePct}
                onChange={(e) => setWastePct(e.target.value)}
                className="drawer-input font-mono-num"
              />
            </DrawerField>
            <DrawerField label="Default Price ($)">
              <input
                type="number" min={0} step="0.01" value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                className="drawer-input font-mono-num"
              />
            </DrawerField>
          </div>
          <DrawerField label="Tags (comma-separated)">
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="drawer-input" />
          </DrawerField>
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onClose}
            className="h-9 rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-brand h-9 rounded-md px-4 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : item ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
      <style>{`
        .drawer-input {
          width: 100%; height: 36px; border-radius: 6px; padding: 0 10px;
          background: var(--surface-elevated); border: 1px solid var(--border);
          color: hsl(var(--foreground)); font-size: 13px;
        }
        textarea.drawer-input { height: auto; padding: 8px 10px; }
        .drawer-input:focus { outline: none; box-shadow: 0 0 0 1px var(--brand); }
      `}</style>
    </>
  );
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ----- price history modal ----- */
function PriceHistoryModal({ item, onClose }: { item: LineItem; onClose: () => void }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["price-history", item.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("line_item_prices")
        .select("unit_price, price_books!inner(name, effective_month, created_at)")
        .eq("line_item_master_id", item.id);
      const rows = (data ?? [])
        .map((r) => {
          const pb = r.price_books as unknown as { name: string; effective_month: string | null; created_at: string };
          const dt = pb.effective_month ?? pb.created_at;
          return { date: dt, label: pb.name, price: Number(r.unit_price) };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
      return rows;
    },
  });

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/50" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-2xl"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Price History</h2>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono-num">{item.code}</span> · {item.name}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="h-64 animate-pulse rounded bg-[var(--surface-elevated)]" />
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No price history yet. Upload a price book to start tracking changes.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
                />
                <Line
                  type="monotone" dataKey="price" stroke="var(--brand)"
                  strokeWidth={2} dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}

/* ----- confirm dialog ----- */
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/50" onClick={onCancel} />
      <div
        className="fixed left-1/2 top-1/2 z-40 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border p-6 shadow-2xl"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="h-9 rounded-md border px-4 text-sm font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn("h-9 rounded-md px-4 text-sm font-semibold text-white")}
            style={{ background: "var(--danger)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
