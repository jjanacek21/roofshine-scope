import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useProfile } from "@/hooks/useProfile";
import { LABOR_UOMS, STARTER_LABOR_RATES, type CompanyLaborRate, type LaborUom } from "@/lib/labor-rates";
import { Pencil, Save, X, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function LaborRatesTab() {
  const { data: profile } = useProfile();
  const { data: company } = useCompany();
  const qc = useQueryClient();
  const isAdmin = profile?.role === "owner" || profile?.role === "admin" || profile?.role === "super_admin";
  const [seeding, setSeeding] = useState(false);

  const { data: rates = [], isLoading } = useQuery({
    queryKey: ["company_labor_rates", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_labor_rates")
        .select("*")
        .eq("company_id", company!.id)
        .order("sort_order")
        .order("task");
      if (error) throw error;
      return (data ?? []) as CompanyLaborRate[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<CompanyLaborRate> & { id?: string }) => {
      if (!company?.id) throw new Error("No company");
      const payload = {
        company_id: company.id,
        task: row.task!.trim(),
        uom: row.uom!,
        rate: Number(row.rate) || 0,
        notes: row.notes ?? null,
        sort_order: row.sort_order ?? (rates.length + 1) * 10,
      };
      if (row.id) {
        const { error } = await supabase.from("company_labor_rates").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_labor_rates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["company_labor_rates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_labor_rates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["company_labor_rates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function loadStarter() {
    if (!company?.id) return;
    setSeeding(true);
    try {
      const payload = STARTER_LABOR_RATES.map((r) => ({ ...r, company_id: company.id }));
      const { error } = await supabase.from("company_labor_rates").upsert(payload, {
        onConflict: "company_id,task,uom",
        ignoreDuplicates: true,
      } as never);
      if (error) throw error;
      toast.success(`Loaded ${payload.length} starter labor rates`);
      qc.invalidateQueries({ queryKey: ["company_labor_rates"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  if (!company) return <p className="text-sm text-muted-foreground">No company on file.</p>;
  if (!isAdmin)
    return <p className="text-sm text-muted-foreground">Only admins or owners can edit labor rates.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Your company's labor pricing. Used as defaults when building roof templates and estimates so your crew sees your numbers — not the Global Contractor Network defaults.
      </p>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded bg-[var(--surface-elevated)]" />
      ) : rates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-base font-bold text-foreground">No labor rates yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add your own per-task or per-square labor rates. You can start from a roofing preset or add rows manually.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={loadStarter}
              disabled={seeding}
              className="btn-brand h-9 rounded-md px-4 text-sm font-semibold disabled:opacity-50"
            >
              {seeding ? "Loading…" : `Load starter rates (${STARTER_LABOR_RATES.length})`}
            </button>
          </div>
          <div className="mt-6">
            <ManualAddBlock onCreate={(patch) => upsert.mutate(patch)} />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2 w-20">UOM</th>
                <th className="px-3 py-2 w-28">Rate</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <Row key={r.id} row={r} onSave={(patch) => upsert.mutate({ ...r, ...patch })} onDelete={() => del.mutate(r.id)} />
              ))}
              <NewRow onCreate={(patch) => upsert.mutate(patch)} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ row, onSave, onDelete }: { row: CompanyLaborRate; onSave: (p: Partial<CompanyLaborRate>) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [task, setTask] = useState(row.task);
  const [uom, setUom] = useState<LaborUom>(row.uom);
  const [rate, setRate] = useState(String(row.rate));
  const [notes, setNotes] = useState(row.notes ?? "");

  if (!editing) {
    return (
      <tr className="border-t" style={{ borderColor: "var(--border)" }}>
        <td className="px-3 py-2 text-foreground">{row.task}</td>
        <td className="px-3 py-2 text-muted-foreground">/{row.uom}</td>
        <td className="px-3 py-2 font-mono">${Number(row.rate).toFixed(2)}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{row.notes ?? "—"}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1">
            <button onClick={() => setEditing(true)} className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-300">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2"><Cell value={task} onChange={setTask} /></td>
      <td className="px-3 py-2"><UomSelect value={uom} onChange={setUom} /></td>
      <td className="px-3 py-2"><Cell value={rate} onChange={setRate} type="number" mono /></td>
      <td className="px-3 py-2"><Cell value={notes} onChange={setNotes} /></td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button onClick={() => { onSave({ task, uom, rate: Number(rate) || 0, notes: notes || null }); setEditing(false); }} className="rounded bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white">
            <Save className="h-3 w-3" />
          </button>
          <button onClick={() => setEditing(false)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
            <X className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function NewRow({ onCreate }: { onCreate: (p: Partial<CompanyLaborRate>) => void }) {
  const [task, setTask] = useState("");
  const [uom, setUom] = useState<LaborUom>("sq");
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");

  function add() {
    if (!task.trim()) return toast.error("Task name required");
    onCreate({ task, uom, rate: Number(rate) || 0, notes: notes || null });
    setTask(""); setRate(""); setNotes(""); setUom("sq");
  }

  return (
    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2"><Cell value={task} onChange={setTask} placeholder="e.g. Install metal roof" /></td>
      <td className="px-3 py-2"><UomSelect value={uom} onChange={setUom} /></td>
      <td className="px-3 py-2"><Cell value={rate} onChange={setRate} type="number" mono placeholder="0.00" /></td>
      <td className="px-3 py-2"><Cell value={notes} onChange={setNotes} placeholder="Optional" /></td>
      <td className="px-3 py-2 text-right">
        <button onClick={add} className="btn-brand inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-semibold">
          <Plus className="h-3 w-3" /> Add
        </button>
      </td>
    </tr>
  );
}

function ManualAddBlock({ onCreate }: { onCreate: (p: Partial<CompanyLaborRate>) => void }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border bg-[var(--surface-elevated)] p-3" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm">
        <tbody><NewRow onCreate={onCreate} /></tbody>
      </table>
    </div>
  );
}

function Cell({
  value,
  onChange,
  type = "text",
  mono = false,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-8 w-full rounded border bg-[var(--surface)] px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]",
        mono && "font-mono",
      )}
      style={{ borderColor: "var(--border)" }}
    />
  );
}

function UomSelect({ value, onChange }: { value: LaborUom; onChange: (v: LaborUom) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as LaborUom)}
      className="h-8 w-full rounded border bg-[var(--surface)] px-2 text-sm text-foreground"
      style={{ borderColor: "var(--border)" }}
    >
      {LABOR_UOMS.map((u) => (
        <option key={u} value={u}>/{u}</option>
      ))}
    </select>
  );
}
