import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, Layers, Wrench, Sliders, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SpfProductRow, SpfDetailRow, SpfStackRow, SpfStackLayerRow, SpfFieldDefaultRow,
} from "@/lib/spf/catalog";
import { fetchSpfCatalog } from "@/lib/spf/catalog";

export const Route = createFileRoute("/admin/spf")({
  component: AdminSpfPage,
});

const METHODS = ["spray", "roll", "brush"] as const;
const ROLES = ["primer", "detail", "base", "top"] as const;
const UNITS = ["ea", "lf", "ls"] as const;
const SCOPES = ["field", "pct", "seams", "details", "custom"] as const;

function useSpfAdminCatalog() {
  return useQuery({ queryKey: ["spf-catalog"], queryFn: fetchSpfCatalog });
}

function AdminSpfPage() {
  const [tab, setTab] = useState<"products" | "details" | "stacks" | "fields">("products");
  const { data, isLoading, refetch } = useSpfAdminCatalog();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["spf-catalog"] });
    refetch();
  };

  const tabs = [
    { id: "products" as const, label: "Products", icon: Layers },
    { id: "details" as const, label: "Details catalog", icon: Wrench },
    { id: "stacks" as const, label: "Coating stacks", icon: ListChecks },
    { id: "fields" as const, label: "Field defaults", icon: Sliders },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">SPF Calculator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the global SPF catalog — coating products, detail line items, preset stacks, and per-field defaults / Simple-mode visibility. Every Roof King company uses this catalog.
        </p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-[var(--brand)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {tab === "products" && <ProductsTab rows={data.products} onChange={invalidate} />}
          {tab === "details" && <DetailsTab rows={data.details} onChange={invalidate} />}
          {tab === "stacks" && (
            <StacksTab
              stacks={data.stacks}
              layers={data.stackLayers}
              products={data.products}
              onChange={invalidate}
            />
          )}
          {tab === "fields" && (
            <FieldsTab
              rows={data.fieldDefaults}
              settingsMode={data.settings.default_mode}
              onChange={invalidate}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- Products ---------------- */

function ProductsTab({ rows, onChange }: { rows: SpfProductRow[]; onChange: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Partial<SpfProductRow>>>({});
  const merged = (r: SpfProductRow) => ({ ...r, ...(draft[r.id] ?? {}) });
  const patch = (id: string, p: Partial<SpfProductRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? {}), ...p } }));

  const save = async (r: SpfProductRow) => {
    setSaving(r.id);
    const m = merged(r);
    const { error } = await supabase.from("spf_products").update({
      name: m.name, solids_pct: Number(m.solids_pct), cost_per_gal: Number(m.cost_per_gal),
      default_mils: Number(m.default_mils), default_method: m.default_method, role: m.role,
      sort_order: Number(m.sort_order), active: m.active,
    }).eq("id", r.id);
    setSaving(null);
    if (error) toast.error(error.message); else {
      setDraft((d) => { const n = { ...d }; delete n[r.id]; return n; });
      toast.success("Saved"); onChange();
    }
  };

  const add = async () => {
    const maxOrder = Math.max(-1, ...rows.map((r) => r.sort_order)) + 1;
    const { error } = await supabase.from("spf_products").insert({
      name: "New product", solids_pct: 100, cost_per_gal: 50, default_mils: 20,
      default_method: "spray", role: "base", sort_order: maxOrder,
    });
    if (error) toast.error(error.message); else { toast.success("Added"); onChange(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product? Any stack layers using it will block deletion.")) return;
    const { error } = await supabase.from("spf_products").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); onChange(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={add} className="btn-brand inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> Add product
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--bg-card)" }}>
              <th className="p-2">Order</th><th className="p-2">Name</th><th className="p-2">Solids %</th>
              <th className="p-2">$/gal</th><th className="p-2">Mils</th><th className="p-2">Method</th>
              <th className="p-2">Role</th><th className="p-2">Active</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = merged(r);
              const dirty = !!draft[r.id];
              return (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="p-2"><Input type="number" value={String(m.sort_order)} onChange={(v) => patch(r.id, { sort_order: Number(v) })} w={70} /></td>
                  <td className="p-2"><Input value={String(m.name)} onChange={(v) => patch(r.id, { name: v })} /></td>
                  <td className="p-2"><Input type="number" value={String(m.solids_pct)} onChange={(v) => patch(r.id, { solids_pct: Number(v) })} w={80} /></td>
                  <td className="p-2"><Input type="number" value={String(m.cost_per_gal)} onChange={(v) => patch(r.id, { cost_per_gal: Number(v) })} w={80} /></td>
                  <td className="p-2"><Input type="number" value={String(m.default_mils)} onChange={(v) => patch(r.id, { default_mils: Number(v) })} w={70} /></td>
                  <td className="p-2"><Select value={m.default_method} opts={METHODS as unknown as string[]} onChange={(v) => patch(r.id, { default_method: v as SpfProductRow["default_method"] })} /></td>
                  <td className="p-2"><Select value={m.role} opts={ROLES as unknown as string[]} onChange={(v) => patch(r.id, { role: v as SpfProductRow["role"] })} /></td>
                  <td className="p-2"><input type="checkbox" checked={!!m.active} onChange={(e) => patch(r.id, { active: e.target.checked })} /></td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <button disabled={!dirty || saving === r.id} onClick={() => save(r)} className="inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] disabled:opacity-40" style={{ borderColor: "var(--border)" }}>
                        <Save className="h-3 w-3" /> Save
                      </button>
                      <button onClick={() => remove(r.id)} className="inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] text-destructive" style={{ borderColor: "var(--border)" }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Details ---------------- */

function DetailsTab({ rows, onChange }: { rows: SpfDetailRow[]; onChange: () => void }) {
  const [draft, setDraft] = useState<Record<string, Partial<SpfDetailRow>>>({});
  const merged = (r: SpfDetailRow) => ({ ...r, ...(draft[r.id] ?? {}) });
  const patch = (id: string, p: Partial<SpfDetailRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? {}), ...p } }));

  const save = async (r: SpfDetailRow) => {
    const m = merged(r);
    const { error } = await supabase.from("spf_details").update({
      label: m.label, unit: m.unit, default_qty: Number(m.default_qty),
      unit_cost: Number(m.unit_cost), sort_order: Number(m.sort_order), active: m.active,
    }).eq("id", r.id);
    if (error) toast.error(error.message); else {
      setDraft((d) => { const n = { ...d }; delete n[r.id]; return n; });
      toast.success("Saved"); onChange();
    }
  };
  const add = async () => {
    const maxOrder = Math.max(-1, ...rows.map((r) => r.sort_order)) + 1;
    const { error } = await supabase.from("spf_details").insert({
      label: "New detail line", unit: "ea", default_qty: 0, unit_cost: 0, sort_order: maxOrder,
    });
    if (error) toast.error(error.message); else { toast.success("Added"); onChange(); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this detail?")) return;
    const { error } = await supabase.from("spf_details").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); onChange(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={add} className="btn-brand inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> Add detail
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--bg-card)" }}>
              <th className="p-2">Order</th><th className="p-2">Label</th><th className="p-2">Unit</th>
              <th className="p-2">Default qty</th><th className="p-2">Unit cost</th><th className="p-2">Active</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = merged(r);
              const dirty = !!draft[r.id];
              return (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="p-2"><Input type="number" value={String(m.sort_order)} onChange={(v) => patch(r.id, { sort_order: Number(v) })} w={70} /></td>
                  <td className="p-2"><Input value={String(m.label)} onChange={(v) => patch(r.id, { label: v })} /></td>
                  <td className="p-2"><Select value={m.unit} opts={UNITS as unknown as string[]} onChange={(v) => patch(r.id, { unit: v as SpfDetailRow["unit"] })} /></td>
                  <td className="p-2"><Input type="number" value={String(m.default_qty)} onChange={(v) => patch(r.id, { default_qty: Number(v) })} w={90} /></td>
                  <td className="p-2"><Input type="number" value={String(m.unit_cost)} onChange={(v) => patch(r.id, { unit_cost: Number(v) })} w={90} /></td>
                  <td className="p-2"><input type="checkbox" checked={!!m.active} onChange={(e) => patch(r.id, { active: e.target.checked })} /></td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <button disabled={!dirty} onClick={() => save(r)} className="inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] disabled:opacity-40" style={{ borderColor: "var(--border)" }}>
                        <Save className="h-3 w-3" /> Save
                      </button>
                      <button onClick={() => remove(r.id)} className="inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] text-destructive" style={{ borderColor: "var(--border)" }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Stacks ---------------- */

function StacksTab({ stacks, layers, products, onChange }: {
  stacks: SpfStackRow[]; layers: SpfStackLayerRow[]; products: SpfProductRow[]; onChange: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(stacks[0]?.id ?? null);
  const active = stacks.find((s) => s.id === activeId) ?? null;
  const stackLayers = useMemo(
    () => layers.filter((l) => l.stack_id === activeId).sort((a, b) => a.sort_order - b.sort_order),
    [layers, activeId],
  );

  const addStack = async () => {
    const key = prompt("Stack key (e.g. sil2)");
    if (!key) return;
    const { data, error } = await supabase.from("spf_stacks").insert({
      key, label: key, sort_order: stacks.length,
    }).select("id").single();
    if (error) toast.error(error.message); else { setActiveId(data!.id); onChange(); }
  };
  const deleteStack = async (id: string) => {
    if (!confirm("Delete stack and all its layers?")) return;
    const { error } = await supabase.from("spf_stacks").delete().eq("id", id);
    if (error) toast.error(error.message); else { setActiveId(null); onChange(); }
  };
  const saveStack = async (patch: Partial<SpfStackRow>) => {
    if (!active) return;
    const { error } = await supabase.from("spf_stacks").update(patch).eq("id", active.id);
    if (error) toast.error(error.message); else onChange();
  };

  const addLayer = async () => {
    if (!active || !products[0]) return;
    const { error } = await supabase.from("spf_stack_layers").insert({
      stack_id: active.id, product_id: products[0].id,
      scope: "field", amount: 100, method: "spray", mils: 12,
      sort_order: stackLayers.length, on_by_default: true,
    });
    if (error) toast.error(error.message); else onChange();
  };
  const patchLayer = async (id: string, p: Partial<SpfStackLayerRow>) => {
    const { error } = await supabase.from("spf_stack_layers").update(p).eq("id", id);
    if (error) toast.error(error.message); else onChange();
  };
  const removeLayer = async (id: string) => {
    const { error } = await supabase.from("spf_stack_layers").delete().eq("id", id);
    if (error) toast.error(error.message); else onChange();
  };

  return (
    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stacks</span>
          <button onClick={addStack} className="text-[11px] text-primary hover:underline">+ new</button>
        </div>
        <ul className="space-y-0.5">
          {stacks.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs",
                  s.id === activeId ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <span>{s.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{s.key}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {!active ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
          Select or create a stack.
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-end justify-between gap-3">
            <div className="grid flex-1 grid-cols-3 gap-2">
              <LabeledInput label="Key" value={active.key} onChange={(v) => saveStack({ key: v })} />
              <LabeledInput label="Label" value={active.label} onChange={(v) => saveStack({ label: v })} />
              <LabeledInput label="Sort" type="number" value={String(active.sort_order)} onChange={(v) => saveStack({ sort_order: Number(v) })} />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={active.active} onChange={(e) => saveStack({ active: e.target.checked })} />
              Active
            </label>
            <button onClick={() => deleteStack(active.id)} className="inline-flex h-8 items-center gap-1 rounded border px-2 text-xs text-destructive" style={{ borderColor: "var(--border)" }}>
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>

          <div className="overflow-x-auto rounded border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full min-w-[800px] text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--bg-card)" }}>
                  <th className="p-2">On</th><th className="p-2">Order</th><th className="p-2">Product</th>
                  <th className="p-2">Scope</th><th className="p-2">Amount</th><th className="p-2">Method</th>
                  <th className="p-2">Mils</th><th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {stackLayers.map((l) => (
                  <tr key={l.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-2"><input type="checkbox" checked={l.on_by_default} onChange={(e) => patchLayer(l.id, { on_by_default: e.target.checked })} /></td>
                    <td className="p-2"><Input type="number" w={60} value={String(l.sort_order)} onChange={(v) => patchLayer(l.id, { sort_order: Number(v) })} /></td>
                    <td className="p-2">
                      <select className="rk-input" value={l.product_id} onChange={(e) => patchLayer(l.id, { product_id: e.target.value })}>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="p-2"><Select value={l.scope} opts={SCOPES as unknown as string[]} onChange={(v) => patchLayer(l.id, { scope: v as SpfStackLayerRow["scope"] })} /></td>
                    <td className="p-2"><Input type="number" w={80} value={String(l.amount)} onChange={(v) => patchLayer(l.id, { amount: Number(v) })} /></td>
                    <td className="p-2"><Select value={l.method} opts={METHODS as unknown as string[]} onChange={(v) => patchLayer(l.id, { method: v as SpfStackLayerRow["method"] })} /></td>
                    <td className="p-2"><Input type="number" w={70} value={String(l.mils)} onChange={(v) => patchLayer(l.id, { mils: Number(v) })} /></td>
                    <td className="p-2">
                      <button onClick={() => removeLayer(l.id)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={addLayer} className="inline-flex h-8 items-center gap-1 rounded border px-3 text-xs" style={{ borderColor: "var(--border)" }}>
            <Plus className="h-3.5 w-3.5" /> Add layer
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Field defaults ---------------- */

const GROUP_LABELS: Record<string, string> = {
  project: "Project", existing: "Existing", access: "Access", foam: "Foam",
  reinf: "Reinforcement", labor: "Labor", equip: "Equipment", soft: "Soft costs", markup: "Markup",
};

function FieldsTab({ rows, settingsMode, onChange }: {
  rows: SpfFieldDefaultRow[]; settingsMode: "simple" | "detailed"; onChange: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, Partial<SpfFieldDefaultRow>>>({});
  const merged = (r: SpfFieldDefaultRow) => ({ ...r, ...(draft[r.field_key] ?? {}) });
  const patch = (k: string, p: Partial<SpfFieldDefaultRow>) =>
    setDraft((d) => ({ ...d, [k]: { ...(d[k] ?? {}), ...p } }));

  const save = async (r: SpfFieldDefaultRow) => {
    const m = merged(r);
    const { error } = await supabase.from("spf_field_defaults").update({
      label: m.label, value_text: String(m.value_text), simple_mode: m.simple_mode,
    }).eq("field_key", r.field_key);
    if (error) toast.error(error.message); else {
      setDraft((d) => { const n = { ...d }; delete n[r.field_key]; return n; });
      toast.success("Saved"); onChange();
    }
  };

  const setDefaultMode = async (mode: "simple" | "detailed") => {
    const { error } = await supabase.from("spf_calc_settings").update({ default_mode: mode }).eq("id", true);
    if (error) toast.error(error.message); else { toast.success("Default mode set"); onChange(); }
  };

  const groups = useMemo(() => {
    const map = new Map<string, SpfFieldDefaultRow[]>();
    for (const r of rows) {
      const arr = map.get(r.group_key) ?? [];
      arr.push(r);
      map.set(r.group_key, arr);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ key: k, rows: v.sort((a, b) => a.sort_order - b.sort_order) }));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">Default calculator mode</span>
        <div className="inline-flex overflow-hidden rounded border" style={{ borderColor: "var(--border)" }}>
          {(["simple", "detailed"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDefaultMode(m)}
              className={cn(
                "px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
                settingsMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-muted-foreground">Users can override per-device. Toggle "Simple" per field below to include it in Simple mode.</span>
      </div>

      {groups.map((g) => (
        <div key={g.key} className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <div className="border-b px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            {GROUP_LABELS[g.key] ?? g.key}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="p-2">Field</th><th className="p-2">Label</th>
                <th className="p-2">Default value</th><th className="p-2">In Simple mode</th><th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => {
                const m = merged(r);
                const dirty = !!draft[r.field_key];
                return (
                  <tr key={r.field_key} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-2 font-mono text-[11px] text-muted-foreground">{r.field_key}</td>
                    <td className="p-2"><Input value={String(m.label)} onChange={(v) => patch(r.field_key, { label: v })} /></td>
                    <td className="p-2"><Input value={String(m.value_text)} onChange={(v) => patch(r.field_key, { value_text: v })} w={140} /></td>
                    <td className="p-2"><input type="checkbox" checked={!!m.simple_mode} onChange={(e) => patch(r.field_key, { simple_mode: e.target.checked })} /></td>
                    <td className="p-2">
                      <button disabled={!dirty} onClick={() => save(r)} className="inline-flex h-7 items-center gap-1 rounded border px-2 text-[11px] disabled:opacity-40" style={{ borderColor: "var(--border)" }}>
                        <Save className="h-3 w-3" /> Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Small inputs ---------------- */

function Input({ value, onChange, type = "text", w }: { value: string; onChange: (v: string) => void; type?: string; w?: number }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border bg-background px-2 py-1 text-xs"
      style={{ borderColor: "var(--border)", width: w }}
    />
  );
}
function LabeledInput({ label, ...rest }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Input {...rest} />
    </label>
  );
}
function Select({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border bg-background px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
