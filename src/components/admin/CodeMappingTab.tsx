import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

type MapRow = {
  id: string;
  slot_code: string;
  company_id: string | null;
  target_code: string | null;
  qty_factor: number;
  note: string | null;
  is_active: boolean;
};

type RuleRow = {
  id: string;
  trade: string | null;
  asset_type: string | null;
  match_phrase: string;
  wrong_code: string | null;
  correct_code: string | null;
  correct_unit: string | null;
  guidance: string | null;
  hits: number;
  status: string;
  created_at: string;
};

export function CodeMappingTab() {
  const [rows, setRows] = useState<MapRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [prices, setPrices] = useState<Record<string, { name: string; unit: string; price: number }>>({});
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, Partial<MapRow>>>({});
  const [newSlot, setNewSlot] = useState("");
  const [newTarget, setNewTarget] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: maps, error }, { data: ruleRows }] = await Promise.all([
      supabase.from("roof_template_code_map").select("*").order("slot_code"),
      supabase.from("photo_learning_rules").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (error) toast.error(error.message);
    const list = (maps as MapRow[]) ?? [];
    setRows(list);
    setRules((ruleRows as RuleRow[]) ?? []);

    const codes = Array.from(new Set(list.map((r) => r.target_code).filter((c): c is string => !!c)));
    if (codes.length) {
      const { data: cat } = await supabase
        .from("line_item_master")
        .select("code, name, unit, default_price")
        .in("code", codes)
        .is("company_id", null);
      const map: Record<string, { name: string; unit: string; price: number }> = {};
      for (const c of (cat as Array<{ code: string; name: string; unit: string; default_price: number }>) ?? []) {
        if (!map[c.code]) map[c.code] = { name: c.name, unit: c.unit, price: Number(c.default_price ?? 0) };
      }
      setPrices(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const edit = (id: string, patch: Partial<MapRow>) => {
    setDirty((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveAll = async () => {
    const entries = Object.entries(dirty);
    if (!entries.length) return toast.info("Nothing to save");
    for (const [id, patch] of entries) {
      const { error } = await supabase.from("roof_template_code_map").update(patch).eq("id", id);
      if (error) return toast.error(error.message);
    }
    setDirty({});
    toast.success("Mappings saved");
    load();
  };

  const addRow = async () => {
    if (!newSlot.trim()) return toast.error("Slot code required");
    const { error } = await supabase.from("roof_template_code_map").insert({
      slot_code: newSlot.trim().toUpperCase(),
      target_code: newTarget.trim() || null,
    });
    if (error) return toast.error(error.message);
    setNewSlot("");
    setNewTarget("");
    load();
  };

  const removeRow = async (id: string) => {
    if (!confirm("Delete this mapping?")) return;
    const { error } = await supabase.from("roof_template_code_map").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const setRuleStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("photo_learning_rules").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const unresolved = rows.filter((r) => r.target_code && !prices[r.target_code]).length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          <div className="text-sm font-semibold">Template slot → price book code</div>
          {unresolved > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" /> {unresolved} won't price
            </span>
          )}
          <button
            onClick={saveAll}
            disabled={!Object.keys(dirty).length}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> Save changes
          </button>
        </div>
        <p className="px-5 py-3 text-xs text-muted-foreground">
          Roof system templates use internal slot names like <span className="font-mono">RFG-DRIPEDGE</span>. Each one has
          to point at a real code in your price book, otherwise the estimate line lands at $0.00. Quantity factor converts
          units (for example SQ to SF is 100).
        </p>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-2">Slot</th>
                  <th className="px-3 py-2">Target code</th>
                  <th className="px-3 py-2">Resolves to</th>
                  <th className="px-3 py-2">Qty factor</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const hit = r.target_code ? prices[r.target_code] : undefined;
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-5 py-2 font-mono text-xs">{r.slot_code}</td>
                      <td className="px-3 py-2">
                        <input
                          value={r.target_code ?? ""}
                          onChange={(e) => edit(r.id, { target_code: e.target.value || null })}
                          className="w-24 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {hit ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            {hit.name} · {hit.unit} · ${hit.price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-amber-600">no catalog match</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={r.qty_factor}
                          onChange={(e) => edit(r.id, { qty_factor: Number(e.target.value) })}
                          className="w-20 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={r.note ?? ""}
                          onChange={(e) => edit(r.id, { note: e.target.value || null })}
                          className="w-full min-w-40 rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeRow(r.id)} className="text-muted-foreground hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
          <input
            value={newSlot}
            onChange={(e) => setNewSlot(e.target.value)}
            placeholder="RFG-NEWSLOT"
            className="w-40 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
          />
          <input
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            placeholder="0206"
            className="w-28 rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
          />
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/70"
          >
            <Plus className="h-3.5 w-3.5" /> Add mapping
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">Learned corrections</div>
        <p className="px-5 py-3 text-xs text-muted-foreground">
          Every correction you make on a job photo becomes a rule here, and every rule is fed back into the AI before it
          analyzes the next photo. Pause a rule to stop the AI from following it.
        </p>
        {rules.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No corrections yet. Correct a suggested line item on a job and the rule shows up here.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rules.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">"{r.match_phrase}"</span>
                    {r.asset_type ? <span className="text-muted-foreground"> on {r.asset_type}</span> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {r.wrong_code && <span className="font-mono line-through">{r.wrong_code}</span>}
                    {r.correct_code && <span className="font-mono text-emerald-600">→ {r.correct_code}</span>}
                    {r.correct_unit && <span>{r.correct_unit}</span>}
                    <span>· used {r.hits}×</span>
                    {r.guidance && <span className="italic">· {r.guidance}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setRuleStatus(r.id, r.status === "active" ? "paused" : "active")}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    r.status === "active" ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.status === "active" ? "Active" : "Paused"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
