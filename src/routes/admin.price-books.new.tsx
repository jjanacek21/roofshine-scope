import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { MetadataStep, type MetadataValue } from "@/components/pricebook/MetadataStep";
import { UploadParseStep, type ParsedFile } from "@/components/pricebook/UploadParseStep";
import { MatchConfirmStep, type ExistingItem, type NormalizedRow } from "@/components/pricebook/MatchConfirmStep";

export const Route = createFileRoute("/admin/price-books/new")({
  component: NewMasterPriceBookPage,
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function NewMasterPriceBookPage() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [meta, setMeta] = useState<MetadataValue>({
    name: "", jurisdiction: "", zip_codes: [], effective_month: "", notes: "",
    pricing_type: "insurance",
  });
  const [parsed, setParsedRaw] = useState<ParsedFile | null>(null);
  const [tab, setTab] = useState<"update" | "new" | "ignored">("update");
  const [normalized, setNormalized] = useState<NormalizedRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function setParsed(p: ParsedFile | null) {
    setParsedRaw(p);
    if (p && !meta.name) {
      const nameFromFile = p.file.name.replace(/\.[^.]+$/, "").trim();
      const today = new Date();
      const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
      setMeta((m) => ({
        ...m,
        name: m.name || nameFromFile,
        effective_month: m.effective_month || defaultMonth,
      }));
    }
  }

  const { data: existing = [] } = useQuery({
    queryKey: ["master-catalog-existing"],
    enabled: step === 3,
    queryFn: async (): Promise<ExistingItem[]> => {
      const { data } = await supabase
        .from("line_item_master")
        .select("id, code, name, default_price")
        .is("company_id", null);
      return (data ?? []).map((r) => ({ id: r.id, code: r.code, name: r.name, current_price: r.default_price }));
    },
  });

  const canNext1 =
    parsed &&
    parsed.mapping.includes("code" as never) &&
    parsed.mapping.includes("name" as never) &&
    (
      parsed.mapping.includes("unit_price" as never) ||
      parsed.mapping.includes("line_total" as never) ||
      parsed.mapping.includes("material_cost" as never) ||
      parsed.mapping.includes("labor_cost" as never) ||
      parsed.mapping.includes("equipment_cost" as never)
    );
  const canNext2 = meta.name && meta.pricing_type;

  async function handleConfirm() {
    if (!parsed) return;
    setSubmitting(true);
    try {
      // Source-file upload is best-effort — keep going even if storage fails.
      let path: string | null = null;
      try {
        const candidatePath = `master/${Date.now()}-${parsed.file.name}`;
        const { error: upErr } = await supabase.storage.from("xactimate-uploads").upload(candidatePath, parsed.file);
        if (upErr) {
          console.warn("Source file upload failed:", upErr.message);
          toast.warning(`Source file not stored: ${upErr.message}. Continuing with line items.`);
        } else {
          path = candidatePath;
        }
      } catch (storageErr) {
        console.warn("Source file upload threw:", storageErr);
      }

      const { data: pb, error: pbErr } = await supabase
        .from("price_books")
        .insert({
          company_id: null,
          name: meta.name,
          jurisdiction: meta.jurisdiction || null,
          zip_codes: meta.zip_codes,
          effective_month: meta.effective_month || null,
          notes: meta.notes || null,
          source: "xactimate",
          source_file_url: path,
          is_active: true,
          status: "active",
          item_count: normalized.length,
          pricing_type: meta.pricing_type,
          is_default: true,
          created_by: profile!.id,
        })
        .select("id")
        .single();
      if (pbErr || !pb) throw pbErr ?? new Error("Failed to create master price book");

      const byCode = new Map(existing.map((e) => [e.code.toUpperCase(), e]));
      const toCreate = normalized.filter((r) => !byCode.has(r.code.toUpperCase()));
      const idMap = new Map<string, string>();
      existing.forEach((e) => idMap.set(e.code.toUpperCase(), e.id));

      for (const batch of chunk(toCreate, 500)) {
        const rows = batch.map((r) => ({
          company_id: null,
          code: r.code,
          name: r.name,
          unit: r.unit,
          trade: r.trade,
          category: r.category,
          default_price: r.unit_price,
          status: "active" as const,
        }));
        const { data: inserted, error } = await supabase
          .from("line_item_master")
          .insert(rows)
          .select("id, code");
        if (error) throw error;
        inserted?.forEach((i) => idMap.set(i.code.toUpperCase(), i.id));
      }

      const priceRows = normalized
        .map((r) => {
          const id = idMap.get(r.code.toUpperCase());
          if (!id) return null;
          return {
            price_book_id: pb.id,
            line_item_master_id: id,
            unit_price: r.unit_price,
            labor_pct: r.labor_pct,
            material_pct: r.material_pct,
            equipment_pct: r.equipment_pct,
            material_cost: r.material_cost,
            labor_cost: r.labor_cost,
            equipment_cost: r.equipment_cost,
            misc_cost: r.misc_cost,
            overhead_pct: r.overhead_pct_val,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      for (const batch of chunk(priceRows, 500)) {
        const { error } = await supabase.from("line_item_prices").insert(batch);
        if (error) throw error;
      }

      toast.success(`Extracted & published ${priceRows.length} line items as master pricing`);
      navigate({ to: "/admin/price-books" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <button
          onClick={() => navigate({ to: "/admin/price-books" })}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Master Pricing
        </button>
        <h1 className="text-2xl font-semibold">Upload Master Estimate File</h1>
        <p className="text-sm text-muted-foreground">Extract line items from a Xactimate estimate (PDF, Excel, CSV) and publish them as a master pricing library every company can fall back to.</p>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: step >= n ? "var(--brand)" : "var(--bg-card)",
                color: step >= n ? "white" : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {step > n ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <span className="text-xs font-medium" style={{ color: step >= n ? "var(--text)" : "var(--text-muted)" }}>
              {n === 1 ? "Upload & Extract" : n === 2 ? "Details" : "Review & Save"}
            </span>
            {n < 3 && <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        {step === 1 && <UploadParseStep value={parsed} onChange={setParsed} pricingType={meta.pricing_type} />}
        {step === 2 && <MetadataStep value={meta} onChange={setMeta} />}
        {step === 3 && parsed && (
          <MatchConfirmStep
            parsed={parsed}
            existing={existing}
            activeTab={tab}
            onTabChange={setTab}
            onChange={setNormalized}
            pricingType={meta.pricing_type}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          disabled={step === 1}
          className="inline-flex h-9 items-center gap-1 rounded-md border px-4 text-sm font-medium text-foreground disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}
            className="btn-brand inline-flex h-9 items-center gap-1 rounded-md px-4 text-sm font-semibold disabled:opacity-40"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={submitting || normalized.length === 0}
            className="btn-chrome inline-flex h-9 items-center gap-1 rounded-md px-4 text-sm font-semibold disabled:opacity-40"
          >
            {submitting ? "Saving…" : `Save ${normalized.length} Line Items as Master Pricing`}
          </button>
        )}
      </div>
    </div>
  );
}
