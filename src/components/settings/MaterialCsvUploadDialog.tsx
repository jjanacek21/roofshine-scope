import { useState, useMemo } from "react";
import Papa from "papaparse";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useMaterialCategories } from "@/hooks/useOrderForm";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

const ROW_LIMIT = 5000;

const RowSchema = z.object({
  category: z.string().trim().min(1, "category required"),
  name: z.string().trim().min(1, "name required").max(255),
  sku: z.string().trim().max(120).optional().nullable(),
  uom: z.string().trim().min(1, "uom required").max(20),
  unit_price: z.coerce.number().min(0).max(1_000_000),
  coverage_sq: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().min(0).nullable()).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

type ParsedRow = z.infer<typeof RowSchema>;

const TEMPLATE_CSV = `category,name,sku,uom,unit_price,coverage_sq,notes
shingles,GAF Timberline HDZ Charcoal,GAF-HDZ-CHR,BDL,42.50,0.33,
underlayment,Synthetic Underlayment 10sq,SYN-10,RL,95.00,10,
drip_edge,White Drip Edge 10ft,DE-W-10,LF,1.85,,
`;

export function MaterialCsvUploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: company } = useCompany();
  const { data: cats = [] } = useMaterialCategories();
  const qc = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const summary = useMemo(() => {
    if (!rows) return null;
    return {
      total: rows.length,
      categories: new Set(rows.map((r) => r.category.toLowerCase())).size,
    };
  }, [rows]);

  function handleFile(file: File) {
    setFileName(file.name);
    setRows(null);
    setErrors([]);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        if (result.data.length > ROW_LIMIT) {
          setErrors([`Max ${ROW_LIMIT} rows allowed; file has ${result.data.length}.`]);
          return;
        }
        const errs: string[] = [];
        const parsed: ParsedRow[] = [];
        result.data.forEach((raw, i) => {
          const r = RowSchema.safeParse(raw);
          if (!r.success) {
            errs.push(`Row ${i + 2}: ${r.error.issues[0].message}`);
          } else {
            parsed.push(r.data);
          }
        });
        if (errs.length > 20) errs.splice(20, errs.length, `…and ${errs.length - 20} more`);
        setErrors(errs);
        setRows(parsed);
      },
      error: (err) => setErrors([err.message]),
    });
  }

  async function handleUpload() {
    if (!rows || !company?.id) return;
    setUploading(true);
    try {
      const slugs = Array.from(new Set(rows.map((r) => r.category.trim().toLowerCase())));

      const slugToCompanyCatId = new Map<string, string>();
      for (const slug of slugs) {
        let companyCat = cats.find((c) => c.slug === slug && c.company_id === company.id);
        if (!companyCat) {
          const globalCat = cats.find((c) => c.slug === slug && c.company_id == null);
          const { data: nc, error } = await supabase
            .from("material_categories")
            .insert({
              company_id: company.id,
              slug,
              label: globalCat?.label ?? slug.replace(/_/g, " "),
              sort_order: globalCat?.sort_order ?? 999,
            })
            .select()
            .single();
          if (error) throw error;
          companyCat = nc as never;
        }
        slugToCompanyCatId.set(slug, companyCat!.id);
      }

      const { data: existing, error: exErr } = await supabase
        .from("material_catalog")
        .select("id, category_id, slug, name")
        .eq("company_id", company.id);
      if (exErr) throw exErr;
      const existingKey = new Map<string, string>();
      for (const e of existing ?? []) {
        const key = `${e.category_id}::${(e.slug ?? e.name).toLowerCase()}`;
        existingKey.set(key, e.id);
      }

      let inserts = 0;
      let updates = 0;
      const inserted: Array<Record<string, unknown>> = [];
      for (const r of rows) {
        const slug = r.category.trim().toLowerCase();
        const catId = slugToCompanyCatId.get(slug)!;
        const matchKey = `${catId}::${(r.sku ?? r.name).toLowerCase()}`;
        const payload: Record<string, unknown> = {
          company_id: company.id,
          category_id: catId,
          name: r.name,
          slug: r.sku ?? null,
          uom: r.uom,
          unit_price: r.unit_price,
          coverage_sq: r.coverage_sq ?? null,
          notes: r.notes ?? null,
          active: true,
        };
        const id = existingKey.get(matchKey);
        if (id) {
          const { error } = await supabase.from("material_catalog").update(payload).eq("id", id);
          if (error) throw error;
          updates++;
        } else {
          inserted.push(payload);
          inserts++;
        }
      }
      if (inserted.length) {
        const { error } = await supabase.from("material_catalog").insert(inserted);
        if (error) throw error;
      }

      toast.success(`Imported ${inserts} new, updated ${updates}`);
      qc.invalidateQueries({ queryKey: ["material_catalog"] });
      qc.invalidateQueries({ queryKey: ["material_categories"] });
      onClose();
      setRows(null);
      setFileName("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "material-price-list-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border bg-[var(--surface)] shadow-xl"
        style={{ borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[var(--brand)]" />
            <h2 className="text-base font-semibold text-foreground">Upload material price list (CSV)</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            CSV columns: <code>category, name, sku, uom, unit_price, coverage_sq, notes</code>. Items are matched on
            <code> sku</code> (or name) within a category — matching rows are updated, new rows are inserted as your
            company's custom items.
          </p>

          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Download className="h-3.5 w-3.5" /> Download template CSV
          </button>

          <label
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-semibold text-foreground">
              {fileName || "Click to choose a CSV file"}
            </div>
            <div className="text-xs text-muted-foreground">Max {ROW_LIMIT.toLocaleString()} rows</div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>

          {errors.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <div className="mb-1 flex items-center gap-1 font-semibold text-amber-300">
                <AlertCircle className="h-3.5 w-3.5" /> {errors.length} issue{errors.length === 1 ? "" : "s"} found
              </div>
              <ul className="ml-5 list-disc space-y-0.5 text-amber-200/80">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {summary && rows && (
            <div className="rounded-lg border bg-[var(--surface-elevated)] p-3 text-sm" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                {summary.total} valid row{summary.total === 1 ? "" : "s"} across {summary.categories} categor{summary.categories === 1 ? "y" : "ies"}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-[var(--surface-elevated)] px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!rows || rows.length === 0 || uploading}
            className="btn-brand rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? "Importing…" : rows ? `Import ${rows.length} rows` : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
