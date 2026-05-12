import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Hammer, Calculator, FileText, Package, Printer, Save, History, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useMaterialCatalog,
  useMaterialCategories,
  useRoofTemplates,
  useTemplateLines,
  useJobOrderDraft,
  useSuppliers,
  useApprovedOrderSnapshot,
  type MaterialItem,
  type RoofTemplate,
  type ExtraCost,
} from "@/hooks/useOrderForm";
import { useCompany } from "@/hooks/useCompany";
import { calcQty, fmtMoney, fmtNum, INPUT_LABELS, computeOrderTotals } from "@/lib/order-form-calc";
import { VersionsTab } from "@/components/order-form/VersionsTab";

export const Route = createFileRoute("/_app/jobs/$id/order-form")({
  component: OrderFormPage,
});

type SubTab = "build" | "versions" | "precap" | "crew" | "supplier";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Hammer }[] = [
  { id: "build", label: "Build Order", icon: Hammer },
  { id: "versions", label: "Versions", icon: History },
  { id: "precap", label: "Pre-Cap", icon: Calculator },
  { id: "crew", label: "Crew Work Order", icon: FileText },
  { id: "supplier", label: "Supplier Order", icon: Package },
];

function OrderFormPage() {
  const { id: jobId } = Route.useParams();
  const [tab, setTab] = useState<SubTab>("build");

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      return data;
    },
  });
  const { data: client } = useQuery({
    queryKey: ["job-client", job?.client_id],
    enabled: !!job?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients").select("name, phone, email, address")
        .eq("id", job!.client_id!).maybeSingle();
      return data;
    },
  });

  const { data: company } = useCompany();
  const { data: templates = [] } = useRoofTemplates();
  const { data: categories = [] } = useMaterialCategories();
  const { data: catalog = [] } = useMaterialCatalog();
  const { data: suppliers = [] } = useSuppliers();
  const { data: draft, upsert } = useJobOrderDraft(jobId);
  const { data: approvedSnapshot } = useApprovedOrderSnapshot(jobId);

  const activeTemplateId = draft?.template_id ?? templates[0]?.id ?? null;
  const { data: lines } = useTemplateLines(activeTemplateId);
  const activeTemplate = templates.find((t) => t.id === activeTemplateId) ?? null;

  const inputs = (draft?.inputs ?? {}) as Record<string, number>;
  const matOverrides = draft?.material_overrides ?? [];
  const labOverrides = draft?.labor_overrides ?? [];
  const markupPct = Number(draft?.markup_pct ?? 35);
  const taxPct = Number(draft?.sales_tax_pct ?? 7);
  const dumpCost = Number(draft?.dump_cost ?? 0);
  const permitCost = Number(draft?.permit_cost ?? 0);
  const extraCosts = (draft?.extra_costs ?? []) as ExtraCost[];

  const catalogById = useMemo(() => {
    const m = new Map<string, MaterialItem>();
    catalog.forEach((c) => m.set(c.id, c));
    return m;
  }, [catalog]);
  const catalogByCat = useMemo(() => {
    const m = new Map<string, MaterialItem[]>();
    catalog.forEach((c) => {
      const arr = m.get(c.category_id) ?? [];
      arr.push(c);
      m.set(c.category_id, arr);
    });
    return m;
  }, [catalog]);

  // computed material rows
  const materialRows = useMemo(() => {
    if (!lines?.materials) return [] as Array<{
      line_id: string; label: string; material: MaterialItem | null;
      qty: number; unit_price: number; line_total: number; uom: string;
      category_id: string | null;
    }>;
    return lines.materials.map((ln) => {
      const ov = matOverrides.find((o) => o.line_id === ln.id);
      const matId = ov?.material_id ?? ln.default_material_id ?? null;
      const mat = matId ? catalogById.get(matId) ?? null : null;
      const autoQty = calcQty(ln.formula, inputs, mat?.coverage_sq, mat?.coverage_base);
      const qty = ov?.qty != null ? Number(ov.qty) : autoQty;
      const unit_price = ov?.unit_price != null ? Number(ov.unit_price) : Number(mat?.unit_price ?? 0);
      const excluded = !!ov?.excluded;
      return {
        line_id: ln.id,
        label: ln.label,
        material: mat,
        qty, unit_price, line_total: excluded ? 0 : qty * unit_price,
        uom: mat?.uom ?? "EA",
        category_id: mat?.category_id ?? null,
        excluded,
      };
    });
  }, [lines, matOverrides, inputs, catalogById]);

  const laborRows = useMemo(() => {
    if (!lines?.labor) return [] as Array<{
      line_id: string; task: string; uom: string; qty: number; rate: number; line_total: number;
    }>;
    return lines.labor.map((ln) => {
      const ov = labOverrides.find((o) => o.line_id === ln.id);
      const autoQty = calcQty(ln.formula, inputs);
      const qty = ov?.qty != null ? Number(ov.qty) : autoQty;
      const rate = ov?.rate != null ? Number(ov.rate) : Number(ln.rate);
      return { line_id: ln.id, task: ln.task, uom: ln.uom, qty, rate, line_total: qty * rate };
    });
  }, [lines, labOverrides, inputs]);

  const totals = useMemo(() => {
    const matSubtotal = materialRows.reduce((s, r) => s + r.line_total, 0);
    const tax = matSubtotal * (taxPct / 100);
    const laborTotal = laborRows.reduce((s, r) => s + r.line_total, 0);
    const extras = extraCosts.reduce((s, x) => s + Number(x.amount ?? 0), 0);
    const squares = Number(inputs["sq"] ?? 0);
    return computeOrderTotals({
      matSubtotal, tax, laborTotal,
      dump: dumpCost, permits: permitCost, extras,
      markupPct, squares,
    });
  }, [materialRows, laborRows, taxPct, markupPct, dumpCost, permitCost, extraCosts, inputs]);

  const update = (patch: any) => upsert.mutate(patch);

  const setInput = (key: string, v: number) => update({ inputs: { ...inputs, [key]: v } });
  const setMatOverride = (line_id: string, change: any) => {
    const others = matOverrides.filter((o) => o.line_id !== line_id);
    const cur = matOverrides.find((o) => o.line_id === line_id) ?? { line_id };
    update({ material_overrides: [...others, { ...cur, ...change }] });
  };
  const setLabOverride = (line_id: string, change: any) => {
    const others = labOverrides.filter((o) => o.line_id !== line_id);
    const cur = labOverrides.find((o) => o.line_id === line_id) ?? { line_id };
    update({ labor_overrides: [...others, { ...cur, ...change }] });
  };
  const setExtras = (next: ExtraCost[]) => update({ extra_costs: next });

  // Initial: if no draft yet but templates loaded, set default template
  useEffect(() => {
    if (!draft && templates.length > 0 && !upsert.isPending) {
      update({ template_id: templates[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, templates.length]);

  const saveSnapshot = async () => {
    if (!company?.id) return;
    const squares = Number(inputs["sq"] ?? 0);
    const { error } = await supabase.from("job_order_snapshots").insert({
      job_id: jobId,
      company_id: company.id,
      template_label: activeTemplate?.label ?? null,
      inputs,
      materials: materialRows.map((r) => ({
        label: r.label, material_id: r.material?.id ?? null, name: r.material?.name ?? r.label,
        uom: r.uom, qty: r.qty, unit_price: r.unit_price, line_total: r.line_total,
      })),
      labor: laborRows.map((r) => ({ task: r.task, uom: r.uom, qty: r.qty, rate: r.rate, line_total: r.line_total })),
      totals,
      dump_cost: dumpCost,
      permit_cost: permitCost,
      extra_costs: extraCosts,
      total_squares: squares,
      per_sq_price: totals.perSq,
      cost_per_sq: totals.costPerSq,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Snapshot saved as draft — submit for approval from the Versions tab");
  };

  const supplier = suppliers[0] ?? null;
  const customer = { name: client?.name ?? "—", phone: client?.phone ?? "", email: client?.email ?? "", address: job?.property_address ?? client?.address ?? "" };

  return (
    <div className="space-y-5">
      {/* No-print toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {SUB_TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors",
                  active ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                style={!active ? { borderColor: "var(--border)", background: "var(--bg-card)" } : undefined}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveSnapshot} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-[13px] font-semibold text-background hover:opacity-90">
            <Save className="h-4 w-4" /> Save Snapshot
          </button>
          {tab !== "build" && (
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: "var(--border)" }}>
              <Printer className="h-4 w-4" /> Print / PDF
            </button>
          )}
        </div>
      </div>

      {tab === "build" && (
        <BuildOrderTab
          templates={templates}
          activeTemplate={activeTemplate}
          onPickTemplate={(id) => update({ template_id: id, material_overrides: [], labor_overrides: [] })}
          inputs={inputs}
          setInput={setInput}
          markupPct={markupPct}
          taxPct={taxPct}
          onMarkup={(v) => update({ markup_pct: v })}
          onTax={(v) => update({ sales_tax_pct: v })}
          materialRows={materialRows}
          laborRows={laborRows}
          totals={totals}
          categories={categories}
          catalogByCat={catalogByCat}
          setMatOverride={setMatOverride}
          setLabOverride={setLabOverride}
          autoQty={(formula: any, coverage?: number | null) => calcQty(formula, inputs, coverage)}
          lines={lines}
        />
      )}

      {tab === "precap" && (
        <PrintDoc>
          <PrecapView
            company={company} job={job} customer={customer}
            template={activeTemplate} inputs={inputs}
            materialRows={materialRows} laborRows={laborRows} totals={totals}
          />
        </PrintDoc>
      )}

      {tab === "crew" && (
        <PrintDoc>
          <CrewView company={company} job={job} customer={customer} template={activeTemplate} materialRows={materialRows} laborRows={laborRows} />
        </PrintDoc>
      )}

      {tab === "supplier" && (
        <PrintDoc>
          <SupplierView
            company={company} job={job} customer={customer}
            supplier={supplier} categories={categories}
            materialRows={materialRows} totals={totals}
          />
        </PrintDoc>
      )}
    </div>
  );
}

/* ===================== BUILD ORDER ===================== */
function BuildOrderTab(props: {
  templates: RoofTemplate[]; activeTemplate: RoofTemplate | null;
  onPickTemplate: (id: string) => void;
  inputs: Record<string, number>; setInput: (k: string, v: number) => void;
  markupPct: number; taxPct: number; onMarkup: (n: number) => void; onTax: (n: number) => void;
  materialRows: any[]; laborRows: any[]; totals: any;
  categories: any[]; catalogByCat: Map<string, MaterialItem[]>;
  setMatOverride: (id: string, change: any) => void; setLabOverride: (id: string, change: any) => void;
  autoQty: (f: any, coverage?: number | null) => number;
  lines: any;
}) {
  const { templates, activeTemplate, onPickTemplate, inputs, setInput, markupPct, taxPct, onMarkup, onTax, materialRows, laborRows, totals, categories, catalogByCat, setMatOverride, setLabOverride, autoQty, lines } = props;
  return (
    <div className="space-y-5">
      {/* Template chips */}
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const active = t.id === activeTemplate?.id;
          return (
            <button
              key={t.id}
              onClick={() => onPickTemplate(t.id)}
              className={cn("rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors",
                active ? "bg-foreground text-background border-foreground" : "text-foreground hover:opacity-80")}
              style={!active ? { borderColor: "var(--border)", background: "var(--bg-card)" } : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Measurements */}
      <Card title="Job Measurements">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {(activeTemplate?.inputs ?? []).map((slug) => (
            <div key={slug}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {INPUT_LABELS[slug] ?? slug}
              </label>
              <input
                type="number" min={0} step="any"
                value={Number(inputs[slug] ?? 0)}
                onChange={(e) => setInput(slug, Number(e.target.value))}
                className="mt-1 w-full rounded border bg-transparent px-2 py-1.5 font-mono text-[13px] text-foreground"
                style={{ borderColor: "var(--border)" }}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField label="Markup %" value={markupPct} onChange={onMarkup} />
          <NumField label="Sales Tax %" value={taxPct} onChange={onTax} />
        </div>
      </Card>

      {/* Materials */}
      <Card title="Materials">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left uppercase tracking-wider text-[10px] text-muted-foreground">
                <th className="px-2 py-2">Line</th>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2">UOM</th>
                <th className="px-2 py-2 text-right">Unit $</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {materialRows.map((r, i) => {
                const tplLine = lines?.materials?.[i];
                const useCoverage = !!tplLine?.formula?.use_material_coverage;
                const auto = autoQty(tplLine?.formula, r.material?.coverage_sq);
                const overridden = r.qty !== auto;
                const catId = r.category_id;
                let options: MaterialItem[] = catId ? catalogByCat.get(catId) ?? [] : [];
                if (useCoverage) {
                  const underlaymentCatIds = (categories ?? [])
                    .filter((c: any) => (c.slug ?? "").toLowerCase().startsWith("underlayment"))
                    .map((c: any) => c.id as string);
                  options = underlaymentCatIds.flatMap((cid) => catalogByCat.get(cid) ?? []);
                }
                return (
                  <tr key={r.line_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-2 py-1.5 text-foreground">{r.label}</td>
                    <td className="px-2 py-1.5">
                      <select
                        value={r.material?.id ?? ""}
                        onChange={(e) => setMatOverride(r.line_id, { material_id: e.target.value || null, unit_price: null, qty: null })}
                        className="w-full rounded border bg-transparent px-1.5 py-1 text-[12px] text-foreground"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <option value="">— select —</option>
                        {options.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}{useCoverage && m.coverage_sq ? ` — ${m.coverage_sq} sq/roll` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" min={0} step="any" value={r.qty}
                        onChange={(e) => setMatOverride(r.line_id, { qty: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-20 rounded border bg-transparent px-1.5 py-1 text-right font-mono text-[12px]"
                        style={{ borderColor: "var(--border)" }} />
                      {overridden && <div className="text-[9px] text-muted-foreground">auto: {auto}</div>}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{r.uom}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" min={0} step="0.01" value={r.unit_price}
                        onChange={(e) => setMatOverride(r.line_id, { unit_price: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-24 rounded border bg-transparent px-1.5 py-1 text-right font-mono text-[12px]"
                        style={{ borderColor: "var(--border)" }} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold text-foreground">{fmtMoney(r.line_total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2" style={{ borderColor: "var(--border)" }}>
              <tr><td colSpan={5} className="px-2 py-1.5 text-right uppercase text-[10px] font-bold tracking-wider text-muted-foreground">Materials Subtotal</td><td className="px-2 py-1.5 text-right font-mono font-bold">{fmtMoney(totals.matSubtotal)}</td></tr>
              <tr><td colSpan={5} className="px-2 py-1 text-right uppercase text-[10px] font-bold tracking-wider text-muted-foreground">Sales Tax</td><td className="px-2 py-1 text-right font-mono">{fmtMoney(totals.tax)}</td></tr>
              <tr><td colSpan={5} className="px-2 py-1.5 text-right uppercase text-[10px] font-bold tracking-wider text-foreground">Materials Total</td><td className="px-2 py-1.5 text-right font-mono font-bold text-foreground">{fmtMoney(totals.matTotal)}</td></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Labor */}
      <Card title="Labor">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left uppercase tracking-wider text-[10px] text-muted-foreground">
                <th className="px-2 py-2">Task</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2">UOM</th>
                <th className="px-2 py-2 text-right">Rate</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {laborRows.map((r, i) => {
                const tplLine = lines?.labor?.[i];
                const auto = autoQty(tplLine?.formula);
                const overridden = r.qty !== auto;
                return (
                  <tr key={r.line_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-2 py-1.5 text-foreground">{r.task}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" min={0} step="any" value={r.qty}
                        onChange={(e) => setLabOverride(r.line_id, { qty: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-20 rounded border bg-transparent px-1.5 py-1 text-right font-mono text-[12px]"
                        style={{ borderColor: "var(--border)" }} />
                      {overridden && <div className="text-[9px] text-muted-foreground">auto: {auto}</div>}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{r.uom}</td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" min={0} step="0.01" value={r.rate}
                        onChange={(e) => setLabOverride(r.line_id, { rate: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-24 rounded border bg-transparent px-1.5 py-1 text-right font-mono text-[12px]"
                        style={{ borderColor: "var(--border)" }} />
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmtMoney(r.line_total)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2" style={{ borderColor: "var(--border)" }}>
              <tr><td colSpan={4} className="px-2 py-1.5 text-right uppercase text-[10px] font-bold tracking-wider text-foreground">Labor Total</td><td className="px-2 py-1.5 text-right font-mono font-bold text-foreground">{fmtMoney(totals.laborTotal)}</td></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Job Cost" value={fmtMoney(totals.jobCost)} />
        <SummaryCard label={`Markup ${fmtNum(markupPct, 1)}%`} value={fmtMoney(totals.markup)} />
        <SummaryCard label="Customer Price" value={fmtMoney(totals.customerPrice)} highlight />
        <SummaryCard label={`Profit (${fmtNum(totals.margin, 1)}%)`} value={fmtMoney(totals.profit)} success />
      </div>
    </div>
  );
}

/* ===================== SHARED PIECES ===================== */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type="number" min={0} step="0.1" value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded border bg-transparent px-2 py-1.5 font-mono text-[13px] text-foreground"
        style={{ borderColor: "var(--border)" }} />
    </div>
  );
}
function SummaryCard({ label, value, highlight, success }: { label: string; value: string; highlight?: boolean; success?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      highlight && "bg-foreground text-background border-foreground",
    )} style={!highlight ? { borderColor: "var(--border)", background: "var(--bg-card)" } : undefined}>
      <div className={cn("text-[10px] font-bold uppercase tracking-wider", highlight ? "opacity-80" : "text-muted-foreground")}>{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-bold", success && !highlight && "text-emerald-500")}>{value}</div>
    </div>
  );
}

/* ===================== PRINT DOCS ===================== */
function PrintDoc({ children }: { children: React.ReactNode }) {
  return (
    <div className="print-doc">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: white !important; }
          .print-doc { background: white !important; color: black !important; padding: 0 !important; box-shadow: none !important; }
          .print-doc * { color: black !important; border-color: #999 !important; }
          .print-doc .accent { color: #b8860b !important; }
          .print-doc .invert { background: black !important; color: white !important; }
        }
      `}</style>
      <div className="rounded-xl bg-white p-8 text-black shadow-lg">
        {children}
      </div>
    </div>
  );
}

function DocHeader({ company, title, badge }: { company: any; title: string; badge?: string }) {
  return (
    <div className="mb-6 flex items-start justify-between border-b-2 border-black pb-4">
      <div className="flex items-center gap-3">
        {company?.logo_url && <img src={company.logo_url} alt={company.name} className="h-12 w-auto" />}
        <div>
          <div className="text-xl font-bold">{company?.name ?? "—"}</div>
          {company?.phone && <div className="text-[11px]">{company.phone} · {company.email}</div>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold uppercase tracking-wider">{title}</div>
        {badge && <div className="mt-1 inline-block bg-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-white">{badge}</div>}
      </div>
    </div>
  );
}

function JobInfoBar({ job, customer }: { job: any; customer: any }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 text-[11px] sm:grid-cols-4">
      <Info label="Job" value={job?.name ?? job?.job_number ?? "—"} />
      <Info label="Address" value={customer.address || "—"} />
      <Info label="Customer" value={customer.name || "—"} />
      <Info label="Date" value={new Date().toLocaleDateString()} />
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function PrecapView({ company, job, customer, template, inputs, materialRows, laborRows, totals }: any) {
  return (
    <>
      <DocHeader company={company} title="Pre-Cap" badge="Internal — Do Not Share" />
      <JobInfoBar job={job} customer={customer} />

      <Section title={`${template?.label ?? ""} — Measurements`}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 text-[11px]">
          {(template?.inputs ?? []).map((k: string) => (
            <div key={k} className="border border-gray-300 p-2">
              <div className="text-[9px] uppercase tracking-wider text-gray-600">{INPUT_LABELS[k] ?? k}</div>
              <div className="font-mono font-bold">{fmtNum(Number(inputs[k] ?? 0))}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Materials">
        <PrintTable cols={["Line", "Product", "Qty", "UOM", "Unit", "Total"]}
          rows={materialRows.map((r: any) => [r.label, r.material?.name ?? "—", fmtNum(r.qty), r.uom, fmtMoney(r.unit_price), fmtMoney(r.line_total)])} />
        <FootRow label="Materials Subtotal" value={fmtMoney(totals.matSubtotal)} />
        <FootRow label="Sales Tax" value={fmtMoney(totals.tax)} />
        <FootRow label="Materials Total" value={fmtMoney(totals.matTotal)} bold />
      </Section>

      <Section title="Labor">
        <PrintTable cols={["Task", "Qty", "UOM", "Rate", "Total"]}
          rows={laborRows.map((r: any) => [r.task, fmtNum(r.qty), r.uom, fmtMoney(r.rate), fmtMoney(r.line_total)])} />
        <FootRow label="Labor Total" value={fmtMoney(totals.laborTotal)} bold />
      </Section>

      <div className="mt-6 space-y-1 text-[11px]">
        <FootRow label="Job Cost" value={fmtMoney(totals.jobCost)} />
        <FootRow label="Markup" value={fmtMoney(totals.markup)} />
        <div className="invert mt-2 flex justify-between bg-black px-3 py-2 text-base font-bold text-white">
          <span>CUSTOMER PRICE</span><span className="font-mono accent" style={{ color: "#d4af37" }}>{fmtMoney(totals.customerPrice)}</span>
        </div>
        <div className="mt-2 flex justify-between bg-emerald-100 px-3 py-2 font-bold text-emerald-900">
          <span>Profit ({fmtNum(totals.margin, 1)}%)</span><span className="font-mono">{fmtMoney(totals.profit)}</span>
        </div>
      </div>
    </>
  );
}

function CrewView({ company, job, customer, template, materialRows, laborRows }: any) {
  return (
    <>
      <DocHeader company={company} title="Crew Work Order" />
      <JobInfoBar job={job} customer={customer} />
      <div className="mb-4 border-l-4 border-yellow-500 bg-yellow-50 p-3 text-[12px]">
        <div className="text-[9px] font-bold uppercase tracking-widest">Scope Summary</div>
        <div className="mt-1 font-semibold">{template?.label ?? "—"} system installation per attached scope.</div>
      </div>

      <Section title="Scope of Work">
        <table className="w-full text-[11px]">
          <thead><tr className="border-b border-black"><th className="w-8 py-1"></th><th className="text-left py-1">Task</th><th className="text-right py-1">Qty</th><th className="text-left py-1 pl-2">UOM</th></tr></thead>
          <tbody>{laborRows.map((r: any) => (
            <tr key={r.line_id} className="border-b border-gray-200"><td className="py-1">☐</td><td className="py-1">{r.task}</td><td className="text-right font-mono py-1">{fmtNum(r.qty)}</td><td className="py-1 pl-2 font-mono">{r.uom}</td></tr>
          ))}</tbody>
        </table>
      </Section>

      <Section title="Materials On Site">
        <table className="w-full text-[11px]">
          <thead><tr className="border-b border-black"><th className="w-8 py-1"></th><th className="text-left py-1">Material</th><th className="text-right py-1">Qty</th><th className="text-left py-1 pl-2">UOM</th></tr></thead>
          <tbody>{materialRows.map((r: any) => (
            <tr key={r.line_id} className="border-b border-gray-200"><td className="py-1">☐</td><td className="py-1">{r.material?.name ?? r.label}</td><td className="text-right font-mono py-1">{fmtNum(r.qty)}</td><td className="py-1 pl-2 font-mono">{r.uom}</td></tr>
          ))}</tbody>
        </table>
      </Section>

      <Section title="Notes">
        <div className="h-24 border border-gray-400" />
      </Section>

      <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div><div className="border-b border-black h-10" /><div className="mt-1 font-bold uppercase tracking-wider">Crew Lead Signature</div></div>
        <div><div className="border-b border-black h-10" /><div className="mt-1 font-bold uppercase tracking-wider">Project Manager Signature</div></div>
      </div>
    </>
  );
}

function SupplierView({ company, job, customer, supplier, categories, materialRows, totals }: any) {
  // group by category
  const groups: Record<string, any[]> = {};
  materialRows.forEach((r: any) => {
    const cat = categories.find((c: any) => c.id === r.category_id);
    const key = cat?.label ?? "Other";
    (groups[key] ??= []).push(r);
  });
  return (
    <>
      <DocHeader company={company} title="Supplier Order" />
      <div className="mb-4 grid grid-cols-2 gap-4 text-[11px]">
        <div className="border border-gray-400 p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest">Supplier</div>
          <div className="mt-1 font-bold">{supplier?.name ?? "—"}</div>
          {supplier?.branch && <div>{supplier.branch}</div>}
          {supplier?.rep_name && <div className="mt-1">{supplier.rep_name} · {supplier.rep_phone}</div>}
          {supplier?.rep_email && <div>{supplier.rep_email}</div>}
        </div>
        <div className="border border-gray-400 p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest">Deliver To</div>
          <div className="mt-1 font-bold">{job?.name ?? "Job"}</div>
          <div>{customer.address}</div>
          <div className="mt-1">Contact: {customer.name} {customer.phone}</div>
        </div>
      </div>

      {Object.entries(groups).map(([catLabel, rows]) => (
        <div key={catLabel} className="mb-3">
          <div className="invert bg-black px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white" style={{ color: "#d4af37" }}>{catLabel}</div>
          <PrintTable cols={["Product", "Qty", "UOM", "Unit", "Total"]}
            rows={rows.map((r: any) => [r.material?.name ?? r.label, fmtNum(r.qty), r.uom, fmtMoney(r.unit_price), fmtMoney(r.line_total)])} />
        </div>
      ))}

      <FootRow label="Materials Subtotal" value={fmtMoney(totals.matSubtotal)} />
      <FootRow label="Sales Tax" value={fmtMoney(totals.tax)} />
      <FootRow label="Materials Total" value={fmtMoney(totals.matTotal)} bold />

      <div className="mt-6 text-[10px] text-gray-600">
        Pricing per supplier pricelist effective on date of order. Confirm availability before delivery.
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest accent" style={{ color: "#b8860b" }}>{title}</div>
      {children}
    </div>
  );
}
function PrintTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-[11px]">
      <thead>
        <tr className="border-b border-black">
          {cols.map((c, i) => (
            <th key={c} className={cn("py-1 font-bold uppercase text-[9px] tracking-wider", i === 0 ? "text-left" : i === cols.length - 1 ? "text-right" : "text-right")}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-gray-200">
            {r.map((cell, j) => (
              <td key={j} className={cn("py-1", j === 0 ? "text-left" : "text-right font-mono")}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function FootRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between border-t border-gray-300 px-2 py-1 text-[11px]", bold && "border-t-2 border-black font-bold")}>
      <span>{label}</span><span className="font-mono">{value}</span>
    </div>
  );
}
