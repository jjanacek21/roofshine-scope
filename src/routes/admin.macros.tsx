import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { TRADES, type Trade } from "@/lib/trades";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/macros")({
  component: AdminMacrosPage,
});

type MasterMacro = {
  id: string;
  name: string;
  description: string | null;
  trade: string | null;
  category: string | null;
  is_default: boolean;
  company_id: string | null;
};

function AdminMacrosPage() {
  const { data: profile } = useProfile();
  const isSuper = profile?.role === "super_admin";
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState<{ macro?: MasterMacro }>({});

  const { data: macros = [], isLoading } = useQuery({
    queryKey: ["admin-master-macros"],
    queryFn: async () => {
      const { data } = await supabase
        .from("master_macros")
        .select("*")
        .is("company_id", null)
        .order("name");
      return (data ?? []) as MasterMacro[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("master_macros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Macro deleted");
      qc.invalidateQueries({ queryKey: ["admin-master-macros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuper) {
    return <p className="text-sm text-muted-foreground">Super admin only.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Master Macros</h1>
          <p className="text-sm text-muted-foreground">
            Reusable bundles of line items every company can adopt and price for themselves.
          </p>
        </div>
        <button
          onClick={() => setEditorOpen({})}
          className="btn-brand flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> New Macro
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : macros.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm text-muted-foreground">No macros yet — create your first reusable bundle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {macros.map((m) => (
            <div key={m.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${m.name}"?`)) del.mutate(m.id);
                  }}
                  className="text-muted-foreground hover:text-red-400"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {m.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {m.trade && <span className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{m.trade}</span>}
                {m.category && <span className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] text-muted-foreground">{m.category}</span>}
              </div>
              <button
                onClick={() => setEditorOpen({ macro: m })}
                className="mt-3 text-xs font-semibold text-[var(--brand)] hover:underline"
              >
                Edit items →
              </button>
            </div>
          ))}
        </div>
      )}

      {(editorOpen.macro !== undefined || Object.keys(editorOpen).length === 0) && editorOpen && (
        <MacroEditor
          key={editorOpen.macro?.id ?? "new"}
          macro={editorOpen.macro}
          onClose={() => setEditorOpen({ macro: undefined } as { macro?: MasterMacro })}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-master-macros"] })}
        />
      )}
    </div>
  );
}

function MacroEditor({
  macro, onClose, onSaved,
}: { macro?: MasterMacro; onClose: () => void; onSaved: () => void }) {
  const [open] = useState(true);
  const [name, setName] = useState(macro?.name ?? "");
  const [description, setDescription] = useState(macro?.description ?? "");
  const [trade, setTrade] = useState<Trade | "">((macro?.trade as Trade) ?? "");
  const [category, setCategory] = useState(macro?.category ?? "");
  const [search, setSearch] = useState("");
  const [savingShell, setSavingShell] = useState(false);

  const { data: existingItems = [] } = useQuery({
    queryKey: ["admin-macro-items", macro?.id],
    enabled: !!macro?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("master_macro_items")
        .select("id, qty, unit, sort_order, line_item_master_id, line_item_master:line_item_master_id(id, code, name, unit, default_price)")
        .eq("macro_id", macro!.id)
        .order("sort_order");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []) as any[];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["macro-li-search", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("line_item_master")
        .select("id, code, name, unit, default_price, trade")
        .or(`code.ilike.%${search}%,name.ilike.%${search}%`)
        .limit(20);
      return data ?? [];
    },
  });

  if (!open) return null;

  async function saveShell() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSavingShell(true);
    try {
      if (macro) {
        const { error } = await supabase
          .from("master_macros")
          .update({
            name: name.trim(),
            description: description || null,
            trade: trade || null,
            category: category || null,
          })
          .eq("id", macro.id);
        if (error) throw error;
        toast.success("Macro updated");
      } else {
        const { error } = await supabase
          .from("master_macros")
          .insert({
            name: name.trim(),
            description: description || null,
            trade: trade || null,
            category: category || null,
            company_id: null,
            is_default: true,
          });
        if (error) throw error;
        toast.success("Macro created");
        onSaved();
        onClose();
      }
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingShell(false);
    }
  }

  async function addItem(liId: string, defaultUnit: string) {
    if (!macro) {
      toast.error("Save the macro first to add items");
      return;
    }
    const { error } = await supabase.from("master_macro_items").insert({
      macro_id: macro.id,
      line_item_master_id: liId,
      qty: 1,
      unit: defaultUnit,
      sort_order: existingItems.length,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Item added");
      onSaved();
      window.location.reload();
    }
  }

  async function removeItem(itemId: string) {
    const { error } = await supabase.from("master_macro_items").delete().eq("id", itemId);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      window.location.reload();
    }
  }

  async function updateQty(itemId: string, qty: number) {
    await supabase.from("master_macro_items").update({ qty }).eq("id", itemId);
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-40 h-full w-full max-w-3xl overflow-y-auto border-l p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{macro ? "Edit" : "New"} Master Macro</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm" style={{ borderColor: "var(--border)" }} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-md border bg-[var(--surface-elevated)] px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Trade</label>
            <select value={trade} onChange={(e) => setTrade(e.target.value as Trade)} className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm" style={{ borderColor: "var(--border)" }}>
              <option value="">—</option>
              {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm" style={{ borderColor: "var(--border)" }} />
          </div>
        </div>

        <button onClick={saveShell} disabled={savingShell} className="btn-brand mt-4 h-9 rounded-md px-4 text-sm font-semibold">
          {macro ? "Save changes" : "Create macro"}
        </button>

        {macro && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Line Items in this macro</h3>
            <div className="mt-3 space-y-2">
              {existingItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">No items yet. Search below to add.</p>
              ) : (
                existingItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex-1">
                      <p className="text-xs font-mono-num text-muted-foreground">{it.line_item_master?.code}</p>
                      <p className="text-sm font-medium">{it.line_item_master?.name}</p>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={it.qty}
                      onBlur={(e) => updateQty(it.id, parseFloat(e.target.value) || 0)}
                      className="h-8 w-20 rounded border bg-[var(--surface-elevated)] px-2 text-right font-mono-num text-xs"
                      style={{ borderColor: "var(--border)" }}
                    />
                    <span className="text-xs text-muted-foreground">{it.unit ?? it.line_item_master?.unit}</span>
                    <button onClick={() => removeItem(it.id)} className="text-muted-foreground hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Add line item</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code or name…"
                className="mt-1 h-10 w-full rounded-md border bg-[var(--surface-elevated)] px-3 text-sm"
                style={{ borderColor: "var(--border)" }}
              />
              {search.length >= 2 && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
                  {searchResults.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No matches.</p>
                  ) : (
                    searchResults.map((li) => (
                      <button
                        key={li.id}
                        onClick={() => addItem(li.id, li.unit)}
                        className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div>
                          <p className="text-xs font-mono-num text-muted-foreground">{li.code}</p>
                          <p>{li.name}</p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
