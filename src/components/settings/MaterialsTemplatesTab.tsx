import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useProfile } from "@/hooks/useProfile";
import {
  useMaterialCategories,
  useMaterialCatalog,
  useRoofTemplates,
  useTemplateLines,
  type MaterialItem,
  type RoofTemplate,
  type TemplateMaterialLine,
  type TemplateLaborLine,
} from "@/hooks/useOrderForm";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Pencil, Save, X, Package, Layers, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaterialCsvUploadDialog } from "./MaterialCsvUploadDialog";

type SubTab = "catalog" | "templates";

export function MaterialsTemplatesTab() {
  const { data: profile } = useProfile();
  const isAdmin =
    profile?.role === "owner" || profile?.role === "admin" || profile?.role === "super_admin";
  const [sub, setSub] = useState<SubTab>("catalog");

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Only admins or owners can edit the material catalog and roof templates.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        <SubTabBtn active={sub === "catalog"} onClick={() => setSub("catalog")} icon={<Package className="h-4 w-4" />} label="Material Catalog" />
        <SubTabBtn active={sub === "templates"} onClick={() => setSub("templates")} icon={<Layers className="h-4 w-4" />} label="Roof Templates" />
      </div>
      {sub === "catalog" ? <CatalogManager /> : <TemplatesManager />}
    </div>
  );
}

function SubTabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[var(--brand)] text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon} {label}
    </button>
  );
}

/* ============ MATERIAL CATALOG ============ */

function CatalogManager() {
  const { data: company } = useCompany();
  const { data: cats = [] } = useMaterialCategories();
  const { data: items = [], isLoading } = useMaterialCatalog();
  const qc = useQueryClient();
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [csvOpen, setCsvOpen] = useState(false);

  const visibleCats = useMemo(() => {
    // Show global + my company categories. Dedupe by slug, prefer company.
    const map = new Map<string, typeof cats[number]>();
    for (const c of cats) {
      if (c.company_id == null && !map.has(c.slug)) map.set(c.slug, c);
    }
    for (const c of cats) {
      if (c.company_id === company?.id) map.set(c.slug, c);
    }
    return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [cats, company?.id]);

  const currentCat = activeCatId
    ? visibleCats.find((c) => c.id === activeCatId)
    : visibleCats[0];

  const filtered = useMemo(() => {
    if (!currentCat) return [] as MaterialItem[];
    const sameSlugCatIds = cats
      .filter((c) => c.slug === currentCat.slug)
      .map((c) => c.id);
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => sameSlugCatIds.includes(i.category_id))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.slug ?? "").toLowerCase().includes(q));
  }, [items, cats, currentCat, search]);

  const upsert = useMutation({
    mutationFn: async (row: Partial<MaterialItem> & { id?: string; category_slug?: string }) => {
      if (!company?.id) throw new Error("No company");
      let companyCat = cats.find((c) => c.slug === row.category_slug && c.company_id === company.id);
      if (!companyCat && row.category_slug) {
        const global = cats.find((c) => c.slug === row.category_slug && c.company_id == null);
        const { data: nc, error: ce } = await supabase
          .from("material_categories")
          .insert({
            company_id: company.id,
            slug: row.category_slug,
            label: global?.label ?? row.category_slug,
            sort_order: global?.sort_order ?? 0,
          })
          .select()
          .single();
        if (ce) throw ce;
        companyCat = nc as any;
      }
      const payload: any = {
        company_id: company.id,
        category_id: companyCat?.id ?? row.category_id,
        name: row.name,
        uom: row.uom,
        unit_price: row.unit_price ?? 0,
        coverage_sq: row.coverage_sq ?? null,
        slug: row.slug ?? null,
        active: row.active ?? true,
      };
      if (row.id) {
        const { error } = await supabase.from("material_catalog").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("material_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["material_catalog"] });
      qc.invalidateQueries({ queryKey: ["material_categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("material_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["material_catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customize material pricing and SKUs for your company. Global defaults are read-only — edit one to create a company-specific copy that overrides it everywhere.
      </p>

      <div className="flex flex-wrap gap-2">
        {visibleCats.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCatId(c.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              currentCat?.id === c.id
                ? "border-[var(--brand)] bg-[var(--brand)]/10 text-foreground"
                : "border-[var(--border)] text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
            {c.company_id === company?.id && <span className="ml-1 text-[10px] opacity-60">(custom)</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search this category…"
          className="h-9 flex-1 rounded-md border bg-[var(--surface-elevated)] px-3 text-sm text-foreground"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          onClick={() => setCsvOpen(true)}
          className="btn-chrome inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold"
        >
          <Upload className="h-3.5 w-3.5" /> Upload CSV
        </button>
      </div>
      <MaterialCsvUploadDialog open={csvOpen} onClose={() => setCsvOpen(false)} />


      {isLoading ? (
        <div className="h-24 animate-pulse rounded bg-[var(--surface-elevated)]" />
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 w-24">UOM</th>
                <th className="px-3 py-2 w-28">Unit Price</th>
                <th className="px-3 py-2 w-28">Coverage (sq)</th>
                <th className="px-3 py-2 w-28">Source</th>
                <th className="px-3 py-2 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <CatalogRow
                  key={row.id}
                  row={row}
                  isMine={row.company_id === company?.id}
                  onSave={(patch) => upsert.mutate({ ...row, ...patch, id: row.company_id === company?.id ? row.id : undefined, category_slug: currentCat?.slug })}
                  onDelete={() => del.mutate(row.id)}
                />
              ))}
              {currentCat && (
                <NewCatalogRow
                  onCreate={(patch) =>
                    upsert.mutate({ ...patch, category_slug: currentCat.slug })
                  }
                />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CatalogRow({
  row,
  isMine,
  onSave,
  onDelete,
}: {
  row: MaterialItem;
  isMine: boolean;
  onSave: (patch: Partial<MaterialItem>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [slug, setSlug] = useState(row.slug ?? "");
  const [uom, setUom] = useState(row.uom);
  const [price, setPrice] = useState(String(row.unit_price));
  const [coverage, setCoverage] = useState(row.coverage_sq != null ? String(row.coverage_sq) : "");

  function save() {
    onSave({
      name, slug: slug || null, uom,
      unit_price: Number(price) || 0,
      coverage_sq: coverage === "" ? null : Number(coverage),
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <tr className="border-t" style={{ borderColor: "var(--border)" }}>
        <td className="px-3 py-2 text-foreground">{row.name}</td>
        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.slug ?? "—"}</td>
        <td className="px-3 py-2 text-muted-foreground">{row.uom}</td>
        <td className="px-3 py-2 font-mono">${Number(row.unit_price).toFixed(2)}</td>
        <td className="px-3 py-2 font-mono text-muted-foreground">{row.coverage_sq != null ? Number(row.coverage_sq) : "—"}</td>
        <td className="px-3 py-2">
          <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", isMine ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300")}>
            {isMine ? "Custom" : "Default"}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1">
            <button onClick={() => setEditing(true)} className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface-elevated)] hover:text-foreground" title={isMine ? "Edit" : "Override"}>
              {isMine ? <Pencil className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {isMine && (
              <button onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-300" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2"><CellInput value={name} onChange={setName} /></td>
      <td className="px-3 py-2"><CellInput value={slug} onChange={setSlug} mono /></td>
      <td className="px-3 py-2"><CellInput value={uom} onChange={setUom} /></td>
      <td className="px-3 py-2"><CellInput value={price} onChange={setPrice} type="number" mono /></td>
      <td className="px-3 py-2"><CellInput value={coverage} onChange={setCoverage} type="number" mono placeholder="e.g. 10" /></td>
      <td className="px-3 py-2 text-[10px] text-muted-foreground">{isMine ? "Editing" : "New copy"}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button onClick={save} className="rounded bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white"><Save className="h-3 w-3" /></button>
          <button onClick={() => setEditing(false)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}><X className="h-3 w-3" /></button>
        </div>
      </td>
    </tr>
  );
}

function NewCatalogRow({ onCreate }: { onCreate: (patch: Partial<MaterialItem>) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [uom, setUom] = useState("EA");
  const [price, setPrice] = useState("0");
  const [coverage, setCoverage] = useState("");

  if (!open) {
    return (
      <tr className="border-t" style={{ borderColor: "var(--border)" }}>
        <td colSpan={7} className="px-3 py-2">
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Add new material
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2"><CellInput value={name} onChange={setName} placeholder="Material name" /></td>
      <td className="px-3 py-2"><CellInput value={slug} onChange={setSlug} placeholder="sku-slug" mono /></td>
      <td className="px-3 py-2"><CellInput value={uom} onChange={setUom} /></td>
      <td className="px-3 py-2"><CellInput value={price} onChange={setPrice} type="number" mono /></td>
      <td className="px-3 py-2"><CellInput value={coverage} onChange={setCoverage} type="number" mono placeholder="sq/unit" /></td>
      <td className="px-3 py-2 text-[10px] text-muted-foreground">New</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={() => {
              if (!name) return;
              onCreate({
                name, slug: slug || null, uom,
                unit_price: Number(price) || 0,
                coverage_sq: coverage === "" ? null : Number(coverage),
                active: true,
              });
              setName(""); setSlug(""); setUom("EA"); setPrice("0"); setCoverage(""); setOpen(false);
            }}
            className="rounded bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white"
          ><Save className="h-3 w-3" /></button>
          <button onClick={() => setOpen(false)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}><X className="h-3 w-3" /></button>
        </div>
      </td>
    </tr>
  );
}

function CellInput({ value, onChange, type = "text", mono = false, placeholder }: { value: string; onChange: (v: string) => void; type?: string; mono?: boolean; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "h-8 w-full rounded border bg-[var(--surface-elevated)] px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--brand)]",
        mono && "font-mono",
      )}
      style={{ borderColor: "var(--border)" }}
    />
  );
}

/* ============ ROOF TEMPLATES ============ */

function TemplatesManager() {
  const { data: company } = useCompany();
  const { data: templates = [] } = useRoofTemplates();
  const [activeId, setActiveId] = useState<string | null>(null);
  const qc = useQueryClient();

  // Dedupe by slug, prefer company copy
  const visible = useMemo(() => {
    const map = new Map<string, RoofTemplate>();
    for (const t of templates) if (t.company_id == null && !map.has(t.slug)) map.set(t.slug, t);
    for (const t of templates) if (t.company_id === company?.id) map.set(t.slug, t);
    return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [templates, company?.id]);

  const current = activeId ? visible.find((t) => t.id === activeId) : visible[0];
  const isMine = current?.company_id === company?.id;

  const cloneToCompany = useMutation({
    mutationFn: async (tpl: RoofTemplate) => {
      if (!company?.id) throw new Error("No company");
      const { data: newTpl, error } = await supabase
        .from("roof_system_templates")
        .insert({
          company_id: company.id,
          slug: tpl.slug,
          label: tpl.label,
          icon: tpl.icon,
          inputs: tpl.inputs as any,
          sort_order: tpl.sort_order,
        })
        .select()
        .single();
      if (error) throw error;

      // Clone lines
      const [{ data: mats }, { data: lab }] = await Promise.all([
        supabase.from("template_material_lines").select("*").eq("template_id", tpl.id),
        supabase.from("template_labor_lines").select("*").eq("template_id", tpl.id),
      ]);
      if (mats?.length) {
        await supabase.from("template_material_lines").insert(
          mats.map((m: any) => ({
            template_id: newTpl.id,
            label: m.label,
            default_material_id: m.default_material_id,
            formula: m.formula,
            sort_order: m.sort_order,
          })),
        );
      }
      if (lab?.length) {
        await supabase.from("template_labor_lines").insert(
          lab.map((l: any) => ({
            template_id: newTpl.id,
            task: l.task,
            uom: l.uom,
            rate: l.rate,
            formula: l.formula,
            sort_order: l.sort_order,
          })),
        );
      }
      return newTpl.id as string;
    },
    onSuccess: (id) => {
      toast.success("Template copied to your company — now editable");
      qc.invalidateQueries({ queryKey: ["roof_templates"] });
      qc.invalidateQueries({ queryKey: ["template_lines"] });
      setActiveId(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Roof system templates drive the Order Form. Default templates are read-only — clone one to make it editable for your company.
      </p>

      <div className="flex flex-wrap gap-2">
        {visible.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              current?.id === t.id
                ? "border-[var(--brand)] bg-[var(--brand)]/10 text-foreground"
                : "border-[var(--border)] text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.company_id === company?.id && <span className="ml-1 text-[10px] opacity-60">(custom)</span>}
          </button>
        ))}
      </div>

      {current && (
        <div className="space-y-4">
          {!isMine && (
            <div className="flex items-center justify-between rounded-lg border border-dashed p-4" style={{ borderColor: "var(--border)" }}>
              <div className="text-sm text-muted-foreground">
                This is a global default template. Clone it to customize labels, formulas, materials, and labor rates.
              </div>
              <button
                onClick={() => cloneToCompany.mutate(current)}
                disabled={cloneToCompany.isPending}
                className="btn-brand h-9 rounded-md px-4 text-sm font-semibold"
              >
                <Copy className="mr-1.5 inline h-3.5 w-3.5" />
                Clone for editing
              </button>
            </div>
          )}
          <TemplateLinesEditor templateId={current.id} editable={isMine} />
        </div>
      )}
    </div>
  );
}

function TemplateLinesEditor({ templateId, editable }: { templateId: string; editable: boolean }) {
  const { data, isLoading } = useTemplateLines(templateId);
  const { data: items = [] } = useMaterialCatalog();
  const qc = useQueryClient();

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["template_lines", templateId] });
  };

  const updateMat = useMutation({
    mutationFn: async (row: TemplateMaterialLine) => {
      const { error } = await supabase
        .from("template_material_lines")
        .update({
          label: row.label,
          default_material_id: row.default_material_id,
          formula: row.formula,
          sort_order: row.sort_order,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("template_material_lines").insert({
        template_id: templateId, label: "New line", formula: { base: "sq", divide_by: 1 }, sort_order: 999,
      });
      if (error) throw error;
    },
    onSuccess: () => refetch(),
    onError: (e: Error) => toast.error(e.message),
  });

  const delMat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("template_material_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLab = useMutation({
    mutationFn: async (row: TemplateLaborLine) => {
      const { error } = await supabase
        .from("template_labor_lines")
        .update({ task: row.task, uom: row.uom, rate: row.rate, formula: row.formula, sort_order: row.sort_order })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLab = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("template_labor_lines").insert({
        template_id: templateId, task: "New labor", uom: "SQ", rate: 0, formula: { base: "sq" }, sort_order: 999,
      });
      if (error) throw error;
    },
    onSuccess: () => refetch(),
    onError: (e: Error) => toast.error(e.message),
  });

  const delLab = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("template_labor_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="h-24 animate-pulse rounded bg-[var(--surface-elevated)]" />;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Material lines</h3>
          {editable && (
            <button onClick={() => addMat.mutate()} className="text-xs font-semibold text-[var(--brand)] hover:underline">
              <Plus className="mr-0.5 inline h-3 w-3" /> Add line
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Default Material</th>
                <th className="px-3 py-2 w-24">Base Input</th>
                <th className="px-3 py-2 w-24">÷ by</th>
                <th className="px-3 py-2 w-24">Waste %</th>
                <th className="px-3 py-2 w-24">Min</th>
                {editable && <th className="px-3 py-2 w-16" />}
              </tr>
            </thead>
            <tbody>
              {(data?.materials ?? []).map((m) => (
                <MatLineRow
                  key={m.id}
                  row={m}
                  items={items}
                  editable={editable}
                  onSave={(patch) => updateMat.mutate({ ...m, ...patch })}
                  onDelete={() => delMat.mutate(m.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Labor lines</h3>
          {editable && (
            <button onClick={() => addLab.mutate()} className="text-xs font-semibold text-[var(--brand)] hover:underline">
              <Plus className="mr-0.5 inline h-3 w-3" /> Add line
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2 w-24">UOM</th>
                <th className="px-3 py-2 w-28">Rate</th>
                <th className="px-3 py-2 w-24">Base Input</th>
                <th className="px-3 py-2 w-24">÷ by</th>
                {editable && <th className="px-3 py-2 w-16" />}
              </tr>
            </thead>
            <tbody>
              {(data?.labor ?? []).map((l) => (
                <LaborLineRow
                  key={l.id}
                  row={l}
                  editable={editable}
                  onSave={(patch) => updateLab.mutate({ ...l, ...patch })}
                  onDelete={() => delLab.mutate(l.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MatLineRow({
  row, items, editable, onSave, onDelete,
}: {
  row: TemplateMaterialLine;
  items: MaterialItem[];
  editable: boolean;
  onSave: (patch: Partial<TemplateMaterialLine>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [matId, setMatId] = useState<string | null>(row.default_material_id);
  const f = (row.formula ?? {}) as any;
  const [base, setBase] = useState(f.base ?? "");
  const [div, setDiv] = useState(String(f.divide_by ?? 1));
  const [waste, setWaste] = useState(String(f.waste_pct ?? 0));
  const [min, setMin] = useState(String(f.min ?? 0));

  const dirty =
    label !== row.label ||
    matId !== row.default_material_id ||
    base !== (f.base ?? "") ||
    Number(div) !== (f.divide_by ?? 1) ||
    Number(waste) !== (f.waste_pct ?? 0) ||
    Number(min) !== (f.min ?? 0);

  return (
    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2">
        {editable ? <CellInput value={label} onChange={setLabel} /> : <span className="text-foreground">{label}</span>}
      </td>
      <td className="px-3 py-2">
        {editable ? (
          <select
            value={matId ?? ""}
            onChange={(e) => setMatId(e.target.value || null)}
            className="h-8 w-full rounded border bg-[var(--surface-elevated)] px-2 text-sm text-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">— none —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">{items.find((i) => i.id === row.default_material_id)?.name ?? "—"}</span>
        )}
      </td>
      <td className="px-3 py-2">{editable ? <CellInput value={base} onChange={setBase} mono /> : <span className="font-mono text-xs text-muted-foreground">{base || "—"}</span>}</td>
      <td className="px-3 py-2">{editable ? <CellInput value={div} onChange={setDiv} type="number" mono /> : <span className="font-mono text-xs text-muted-foreground">{div}</span>}</td>
      <td className="px-3 py-2">{editable ? <CellInput value={waste} onChange={setWaste} type="number" mono /> : <span className="font-mono text-xs text-muted-foreground">{waste}</span>}</td>
      <td className="px-3 py-2">{editable ? <CellInput value={min} onChange={setMin} type="number" mono /> : <span className="font-mono text-xs text-muted-foreground">{min}</span>}</td>
      {editable && (
        <td className="px-3 py-2">
          <div className="flex justify-end gap-1">
            <button
              disabled={!dirty}
              onClick={() => onSave({
                label, default_material_id: matId,
                formula: { base, divide_by: Number(div) || 1, waste_pct: Number(waste) || 0, min: Number(min) || 0 },
              })}
              className={cn("rounded px-2 py-1 text-xs", dirty ? "bg-[var(--brand)] text-white" : "text-muted-foreground")}
            >
              <Save className="h-3 w-3" />
            </button>
            <button onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-300">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function LaborLineRow({
  row, editable, onSave, onDelete,
}: {
  row: TemplateLaborLine;
  editable: boolean;
  onSave: (patch: Partial<TemplateLaborLine>) => void;
  onDelete: () => void;
}) {
  const [task, setTask] = useState(row.task);
  const [uom, setUom] = useState(row.uom);
  const [rate, setRate] = useState(String(row.rate));
  const f = (row.formula ?? {}) as any;
  const [base, setBase] = useState(f.base ?? "");
  const [div, setDiv] = useState(String(f.divide_by ?? 1));

  const dirty =
    task !== row.task || uom !== row.uom || Number(rate) !== Number(row.rate) ||
    base !== (f.base ?? "") || Number(div) !== (f.divide_by ?? 1);

  return (
    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
      <td className="px-3 py-2">{editable ? <CellInput value={task} onChange={setTask} /> : <span className="text-foreground">{task}</span>}</td>
      <td className="px-3 py-2">{editable ? <CellInput value={uom} onChange={setUom} /> : <span className="text-muted-foreground">{uom}</span>}</td>
      <td className="px-3 py-2">{editable ? <CellInput value={rate} onChange={setRate} type="number" mono /> : <span className="font-mono">${Number(rate).toFixed(2)}</span>}</td>
      <td className="px-3 py-2">{editable ? <CellInput value={base} onChange={setBase} mono /> : <span className="font-mono text-xs text-muted-foreground">{base || "—"}</span>}</td>
      <td className="px-3 py-2">{editable ? <CellInput value={div} onChange={setDiv} type="number" mono /> : <span className="font-mono text-xs text-muted-foreground">{div}</span>}</td>
      {editable && (
        <td className="px-3 py-2">
          <div className="flex justify-end gap-1">
            <button
              disabled={!dirty}
              onClick={() => onSave({ task, uom, rate: Number(rate) || 0, formula: { base, divide_by: Number(div) || 1 } })}
              className={cn("rounded px-2 py-1 text-xs", dirty ? "bg-[var(--brand)] text-white" : "text-muted-foreground")}
            >
              <Save className="h-3 w-3" />
            </button>
            <button onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-300">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
