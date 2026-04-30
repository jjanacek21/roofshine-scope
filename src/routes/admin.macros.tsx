import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { TRADES, type Trade } from "@/lib/trades";
import { ASSET_TYPES, assetTypeLabel, type AssetType } from "@/lib/assemblies";
import { Plus, Trash2, X, Search, Layers, Save } from "lucide-react";
import { toast } from "sonner";
import { CatalogTree, type CatalogItem } from "@/components/catalog/CatalogTree";

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
  kind: string;
  asset_type: string | null;
  is_addon: boolean;
};

export default function AdminMacrosPage() {
  const { data: profile } = useProfile();
  const isSuper = profile?.role === "super_admin";
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState<{ open: boolean; macro?: MasterMacro }>({ open: false });

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
      await supabase.from("master_macro_items").delete().eq("macro_id", id);
      const { error } = await supabase.from("master_macros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Macro deleted");
      qc.invalidateQueries({ queryKey: ["admin-master-macros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuper) return <p className="text-sm text-muted-foreground">Super admin only.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Master Assemblies</h1>
          <p className="text-sm text-muted-foreground">
            Bundles of line items grouped by trade and material. The AI uses these to suggest a complete scope from photos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/assemblies/import"
            className="hidden h-9 items-center gap-2 rounded-md border px-4 text-sm font-semibold hover:bg-[var(--surface-hover)] sm:flex"
            style={{ borderColor: "var(--border)" }}
          >
            Import from PDF
          </Link>
          <button
            onClick={() => setEditorOpen({ open: true })}
            className="btn-brand flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> New Assembly
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : macros.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm text-muted-foreground">No assemblies yet — create your first bundle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {macros.map((m) => (
            <div key={m.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">{m.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {m.asset_type && (
                      <span className="inline-flex items-center gap-1 rounded bg-[var(--brand)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--brand)]">
                        <Layers className="h-3 w-3" /> {assetTypeLabel(m.asset_type)}
                      </span>
                    )}
                    {m.is_addon && (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-400">Add-on</span>
                    )}
                    {m.trade && (
                      <span className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{m.trade}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm(`Delete "${m.name}"?`)) del.mutate(m.id); }}
                  className="text-muted-foreground hover:text-red-400"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {m.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{m.description}</p>}
              <button
                onClick={() => setEditorOpen({ open: true, macro: m })}
                className="mt-3 text-xs font-semibold text-[var(--brand)] hover:underline"
              >
                Edit →
              </button>
            </div>
          ))}
        </div>
      )}

      {editorOpen.open && (
        <MacroEditor
          key={editorOpen.macro?.id ?? "new"}
          macro={editorOpen.macro}
          onClose={() => setEditorOpen({ open: false })}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin-master-macros"] })}
        />
      )}
    </div>
  );
}

function MacroEditor({
  macro, onClose, onSaved,
}: { macro?: MasterMacro; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(macro?.name ?? "");
  const [description, setDescription] = useState(macro?.description ?? "");
  const [trade, setTrade] = useState<Trade | "">((macro?.trade as Trade) ?? "");
  const [assetType, setAssetType] = useState<AssetType | "">((macro?.asset_type as AssetType) ?? "");
  const [isAddon, setIsAddon] = useState<boolean>(macro?.is_addon ?? false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Load full catalog (master only).
  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("line_item_master")
        .select("id, code, name, unit, domain, subgroup, default_price, trade")
        .is("company_id", null)
        .eq("status", "active")
        .order("code");
      return (data ?? []) as CatalogItem[];
    },
  });

  // Load existing items for this macro.
  const { data: existingItems = [], refetch: refetchItems } = useQuery({
    queryKey: ["admin-macro-items", macro?.id],
    enabled: !!macro?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("master_macro_items")
        .select("id, line_item_master_id, qty, unit, sort_order, qty_mode")
        .eq("macro_id", macro!.id)
        .order("sort_order");
      return data ?? [];
    },
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Sync selectedIds from existingItems whenever they (re)load.
  useMemo(() => {
    setSelectedIds(new Set(existingItems.map((i) => i.line_item_master_id)));
  }, [existingItems]);

  const selectedItems = useMemo(
    () => catalog.filter((c) => selectedIds.has(c.id)),
    [catalog, selectedIds],
  );

  function toggle(item: CatalogItem) {
    const next = new Set(selectedIds);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    setSelectedIds(next);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      let macroId = macro?.id;
      if (macro) {
        const { error } = await supabase
          .from("master_macros")
          .update({
            name: name.trim(),
            description: description || null,
            trade: trade || null,
            asset_type: assetType || null,
            is_addon: isAddon,
          })
          .eq("id", macro.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("master_macros")
          .insert({
            name: name.trim(),
            description: description || null,
            trade: trade || null,
            asset_type: assetType || null,
            is_addon: isAddon,
            kind: "assembly",
            company_id: null,
            is_default: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        macroId = data.id;
      }

      // Diff items: delete removed, insert added.
      const existingMap = new Map(existingItems.map((i) => [i.line_item_master_id, i]));
      const desired = new Set(selectedIds);
      const toDelete = existingItems.filter((i) => !desired.has(i.line_item_master_id)).map((i) => i.id);
      const toInsert = catalog
        .filter((c) => desired.has(c.id) && !existingMap.has(c.id))
        .map((c, idx) => ({
          macro_id: macroId!,
          line_item_master_id: c.id,
          qty: 0,
          unit: c.unit,
          sort_order: existingItems.length + idx,
          qty_mode: "manual",
          is_optional: false,
        }));

      if (toDelete.length > 0) {
        const { error } = await supabase.from("master_macro_items").delete().in("id", toDelete);
        if (error) throw error;
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from("master_macro_items").insert(toInsert);
        if (error) throw error;
      }

      toast.success(`Saved "${name.trim()}" with ${desired.size} items`);
      onSaved();
      refetchItems();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/60" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-6xl flex-col border-l"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-lg font-bold">{macro ? "Edit" : "New"} Assembly</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="btn-brand flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* Metadata strip */}
        <div className="grid grid-cols-2 gap-3 border-b px-6 py-3 lg:grid-cols-5" style={{ borderColor: "var(--border)" }}>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-8 w-full rounded-md border bg-[var(--surface-elevated)] px-2 text-sm" style={{ borderColor: "var(--border)" }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Trade</label>
            <select value={trade} onChange={(e) => setTrade(e.target.value as Trade)} className="mt-1 h-8 w-full rounded-md border bg-[var(--surface-elevated)] px-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <option value="">—</option>
              {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Asset Type (AI)</label>
            <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)} className="mt-1 h-8 w-full rounded-md border bg-[var(--surface-elevated)] px-2 text-sm" style={{ borderColor: "var(--border)" }}>
              <option value="">—</option>
              {ASSET_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={isAddon} onChange={(e) => setIsAddon(e.target.checked)} className="h-4 w-4" />
              Add-on
            </label>
          </div>
          <div className="col-span-2 lg:col-span-5">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 h-8 w-full rounded-md border bg-[var(--surface-elevated)] px-2 text-sm" style={{ borderColor: "var(--border)" }} />
          </div>
        </div>

        {/* Two-pane body */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_360px]">
          {/* Left: catalog tree */}
          <div className="flex flex-col overflow-hidden border-r" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by code, name, or sub-group…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              <CatalogTree
                items={catalog}
                search={search}
                selectedIds={selectedIds}
                onToggle={toggle}
                mode="checkbox"
              />
            </div>
          </div>
          {/* Right: selected list */}
          <div className="flex flex-col overflow-hidden bg-[var(--bg-card)]">
            <div className="flex items-center justify-between border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Selected ({selectedItems.length})</h3>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[10px] uppercase text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedItems.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">Check items on the left to add them.</p>
              ) : (
                selectedItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 border-b px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}>
                    <span className="font-mono-num shrink-0 rounded px-1 py-0.5 text-[10px]" style={{ border: "1px solid var(--border)" }}>{it.code}</span>
                    <span className="flex-1 truncate">{it.name}</span>
                    <button onClick={() => toggle(it)} className="text-muted-foreground hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
