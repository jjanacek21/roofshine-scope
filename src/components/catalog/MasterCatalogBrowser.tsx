// Admin-side browser for the master line item catalog.
// Two panes: Domain → Subgroup tree on the left, item table on the right.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Search, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Item = {
  id: string;
  code: string;
  name: string;
  unit: string;
  domain: string | null;
  subgroup: string | null;
  default_price: number;
  remove_price: number | null;
  replace_price: number | null;
  hours: number | null;
  material_cost: number | null;
  xactimate_prefix: string | null;
  trade_name: string | null;
};

export function MasterCatalogBrowser() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ domain: string; sub: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["master-catalog-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("line_item_master")
        .select("id, code, name, unit, domain, subgroup, default_price, hours, material_cost, xactimate_prefix, trade_name")
        .is("company_id", null)
        .order("domain")
        .order("subgroup")
        .order("code");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const tree = useMemo(() => {
    const map = new Map<string, Map<string, Item[]>>();
    for (const i of items) {
      const d = i.domain ?? "Other";
      const s = i.subgroup ?? "Other";
      if (!map.has(d)) map.set(d, new Map());
      const sub = map.get(d)!;
      if (!sub.has(s)) sub.set(s, []);
      sub.get(s)!.push(i);
    }
    return map;
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return items.filter(
        (i) =>
          i.code.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.subgroup ?? "").toLowerCase().includes(q) ||
          (i.domain ?? "").toLowerCase().includes(q),
      );
    }
    if (selected) {
      return items.filter((i) => (i.domain ?? "Other") === selected.domain && (i.subgroup ?? "Other") === selected.sub);
    }
    return items;
  }, [items, search, selected]);

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const { error } = await supabase
        .from("line_item_master")
        .update({ default_price: price })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master-catalog-all"] });
      toast.success("Price updated");
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDomain(d: string) {
    const next = new Set(openDomains);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setOpenDomains(next);
  }

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading catalog…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Left: tree */}
      <div className="rounded-xl border bg-card" style={{ borderColor: "var(--border)" }}>
        <div className="border-b p-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {items.length} items · {tree.size} domains
          </p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto text-sm">
          <button
            onClick={() => setSelected(null)}
            className={cn(
              "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-xs font-medium hover:bg-[var(--surface-hover)]",
              !selected && "bg-[var(--brand)]/10 text-[var(--brand)]",
            )}
            style={{ borderColor: "var(--border)" }}
          >
            All items
          </button>
          {Array.from(tree.entries())
            .sort()
            .map(([domain, subgroups]) => {
              const dOpen = openDomains.has(domain);
              const total = Array.from(subgroups.values()).reduce((a, b) => a + b.length, 0);
              return (
                <div key={domain} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={() => toggleDomain(domain)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold hover:bg-[var(--surface-hover)]"
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", dOpen && "rotate-90")} />
                    <span className="flex-1 truncate">{domain}</span>
                    <span className="font-mono-num text-[11px] text-muted-foreground">{total}</span>
                  </button>
                  {dOpen &&
                    Array.from(subgroups.entries())
                      .sort()
                      .map(([sub, subItems]) => {
                        const isSel = selected?.domain === domain && selected?.sub === sub;
                        return (
                          <button
                            key={sub}
                            onClick={() => {
                              setSelected({ domain, sub });
                              setSearch("");
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 pl-9 pr-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-hover)]",
                              isSel && "bg-[var(--brand)]/10 text-[var(--brand)]",
                            )}
                          >
                            <span className="flex-1 truncate text-muted-foreground">{sub}</span>
                            <span className="font-mono-num text-[10px] text-muted-foreground">{subItems.length}</span>
                          </button>
                        );
                      })}
                </div>
              );
            })}
        </div>
      </div>

      {/* Right: items table */}
      <div className="rounded-xl border bg-card" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 border-b p-3" style={{ borderColor: "var(--border)" }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, subgroup…"
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
          <span className="font-mono-num text-xs text-muted-foreground">{visibleItems.length} shown</span>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg-card)]">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Code</th>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Domain / Subgroup</th>
                <th className="px-4 py-2 font-semibold">Unit</th>
                <th className="px-4 py-2 text-right font-semibold">Price</th>
                <th className="px-4 py-2 text-right font-semibold">Hours</th>
                <th className="px-4 py-2 text-right font-semibold">Mat $</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const isEditing = editingId === it.id;
                return (
                  <tr key={it.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2 font-mono-num text-[11px]">{it.code}</td>
                    <td className="px-4 py-2">{it.name}</td>
                    <td className="px-4 py-2 text-[12px] text-muted-foreground">
                      {it.domain ?? "—"} <span className="opacity-50">›</span> {it.subgroup ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{it.unit}</td>
                    <td className="px-4 py-2 text-right font-mono-num">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="h-7 w-24 rounded border bg-background px-2 text-right text-sm"
                          style={{ borderColor: "var(--border)" }}
                          autoFocus
                        />
                      ) : (
                        `$${Number(it.default_price).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono-num text-muted-foreground">
                      {it.hours != null ? Number(it.hours).toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono-num text-muted-foreground">
                      {it.material_cost != null ? `$${Number(it.material_cost).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => updatePrice.mutate({ id: it.id, price: Number(editPrice) })}
                            className="rounded p-1 text-[var(--brand)] hover:bg-[var(--brand)]/10"
                            disabled={updatePrice.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded p-1 text-muted-foreground hover:bg-[var(--surface-hover)]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(it.id);
                            setEditPrice(String(it.default_price ?? 0));
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-[var(--surface-hover)]"
                          aria-label="Edit price"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No items match.
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
