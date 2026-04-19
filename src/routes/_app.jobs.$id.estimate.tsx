import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TierTabs, type EstimateRow } from "@/components/estimate/TierTabs";
import {
  CompanionRulesBanner,
  type CompanionSuggestion,
} from "@/components/estimate/CompanionRulesBanner";
import { LineItemTable, type LineItem } from "@/components/estimate/LineItemTable";
import {
  AddLineItemCombobox,
  type CatalogResult,
} from "@/components/estimate/AddLineItemCombobox";
import {
  AddCustomItemDialog,
  type CustomItemDraft,
} from "@/components/estimate/AddCustomItemDialog";
import {
  EstimateTotalsPanel,
  type EstimatePctEdits,
} from "@/components/estimate/EstimateTotalsPanel";
import { StatusBadge } from "@/components/brand/StatusBadge";
import type { Trade } from "@/lib/trades";

export const Route = createFileRoute("/_app/jobs/$id/estimate")({
  validateSearch: z.object({ codes: z.string().optional() }),
  component: JobEstimate,
});

type EstimateRowFull = EstimateRow & {
  company_id: string;
  job_id: string;
  markup_pct: number;
  overhead_pct: number;
  profit_pct: number;
  tax_pct: number;
  hide_pricing: boolean;
  notes: string | null;
};

function JobEstimate() {
  const { id: jobId } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [companionSuggestion, setCompanionSuggestion] = useState<CompanionSuggestion | null>(
    null,
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const codesAppliedRef = useRef(false);

  // Load job for company / price book / jurisdiction
  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      return data;
    },
  });

  const { data: company } = useQuery({
    queryKey: ["estimate-company", job?.company_id],
    enabled: !!job?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("default_markup_pct, default_overhead_pct, default_profit_pct, default_tax_rate")
        .eq("id", job!.company_id)
        .maybeSingle();
      return data;
    },
  });

  // Estimates list
  const { data: estimates = [] } = useQuery({
    queryKey: ["estimates", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimates")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      return (data ?? []) as EstimateRowFull[];
    },
  });

  // Auto-create "Original" estimate when none exists
  const ensuredRef = useRef(false);
  useEffect(() => {
    if (!job || estimates === undefined || ensuredRef.current) return;
    if (estimates.length === 0 && company) {
      ensuredRef.current = true;
      (async () => {
        const { data, error } = await supabase
          .from("estimates")
          .insert({
            job_id: jobId,
            company_id: job.company_id,
            name: "Original",
            tier: "original",
            markup_pct: Number(company.default_markup_pct ?? 10),
            overhead_pct: Number(company.default_overhead_pct ?? 10),
            profit_pct: Number(company.default_profit_pct ?? 10),
            tax_pct: Number(company.default_tax_rate ?? 0),
          })
          .select()
          .single();
        if (error) {
          ensuredRef.current = false;
          toast.error("Failed to create estimate");
          return;
        }
        qc.invalidateQueries({ queryKey: ["estimates", jobId] });
        setActiveId(data.id);
      })();
    } else if (estimates.length > 0 && !activeId) {
      setActiveId(estimates[0].id);
    }
  }, [job, estimates, company, jobId, qc, activeId]);

  const activeEstimate = estimates.find((e) => e.id === activeId) ?? null;

  // Line items for active estimate
  const { data: items = [] } = useQuery({
    queryKey: ["estimate-items", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", activeId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as LineItem[];
    },
  });

  // Local optimistic copy so debounced updates feel snappy
  const [localItems, setLocalItems] = useState<LineItem[]>([]);
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const subtotal = useMemo(
    () => localItems.reduce((s, i) => s + i.qty * i.unit_price, 0),
    [localItems],
  );

  // Local pcts
  const [pcts, setPcts] = useState<EstimatePctEdits>({
    markup_pct: 0,
    overhead_pct: 0,
    profit_pct: 0,
    tax_pct: 0,
  });
  const [hidePricing, setHidePricing] = useState(false);
  useEffect(() => {
    if (activeEstimate) {
      setPcts({
        markup_pct: Number(activeEstimate.markup_pct ?? 0),
        overhead_pct: Number(activeEstimate.overhead_pct ?? 0),
        profit_pct: Number(activeEstimate.profit_pct ?? 0),
        tax_pct: Number(activeEstimate.tax_pct ?? 0),
      });
      setHidePricing(Boolean(activeEstimate.hide_pricing));
    }
  }, [activeEstimate]);

  // Debounced save of estimate header (pcts + totals)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeEstimate) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const markup = (subtotal * pcts.markup_pct) / 100;
      const overhead = (subtotal * pcts.overhead_pct) / 100;
      const profit = (subtotal * pcts.profit_pct) / 100;
      const beforeTax = subtotal + markup + overhead + profit;
      const tax = (beforeTax * pcts.tax_pct) / 100;
      const total = beforeTax + tax;
      await supabase
        .from("estimates")
        .update({
          markup_pct: pcts.markup_pct,
          overhead_pct: pcts.overhead_pct,
          profit_pct: pcts.profit_pct,
          tax_pct: pcts.tax_pct,
          hide_pricing: hidePricing,
          subtotal,
          tax,
          total,
        })
        .eq("id", activeEstimate.id);
      // bump job total as the active tier price (simple)
      await supabase.from("jobs").update({ total_estimate: total }).eq("id", jobId);
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ["estimates", jobId] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [pcts, hidePricing, subtotal, activeEstimate, jobId, qc]);

  // Item patch (debounced per-item)
  const itemTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patchItem = (itemId: string, patch: Partial<LineItem>) => {
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const next = { ...i, ...patch };
        next.total = next.qty * next.unit_price;
        return next;
      }),
    );
    const existing = itemTimers.current.get(itemId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      const current = localItems.find((i) => i.id === itemId);
      const merged = current ? { ...current, ...patch } : null;
      const updates: {
        name?: string;
        unit?: string;
        qty?: number;
        unit_price?: number;
        total?: number;
      } = {};
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.unit !== undefined) updates.unit = patch.unit;
      if (patch.qty !== undefined) updates.qty = patch.qty;
      if (patch.unit_price !== undefined) updates.unit_price = patch.unit_price;
      if (merged) updates.total = merged.qty * merged.unit_price;
      await supabase.from("estimate_line_items").update(updates).eq("id", itemId);
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
    }, 500);
    itemTimers.current.set(itemId, t);
  };

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estimate_line_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
      toast.success("Item removed");
    },
    onError: () => toast.error("Could not delete item"),
  });

  // Companion rule check
  const checkCompanion = async (category: string | null) => {
    if (!category || !job?.company_id) return;
    const { data } = await supabase
      .from("companion_rules")
      .select("*")
      .eq("company_id", job.company_id)
      .eq("trigger_category", category)
      .or(`jurisdiction.is.null,jurisdiction.eq.${job.jurisdiction ?? ""}`)
      .limit(1);
    const rule = data?.[0];
    if (rule && rule.suggested_codes.length > 0) {
      setCompanionSuggestion({
        id: rule.id,
        triggerCategory: category,
        ruleType: rule.rule_type,
        codes: rule.suggested_codes,
        notes: rule.notes,
      });
    }
  };

  const addCatalogItem = async (item: CatalogResult) => {
    if (!activeId) return;
    const { error } = await supabase.from("estimate_line_items").insert({
      estimate_id: activeId,
      line_item_id: item.id,
      code: item.code,
      name: item.name,
      trade: item.trade as Trade,
      unit: item.unit,
      qty: 1,
      unit_price: item.unit_price,
      total: item.unit_price,
      sort_order: localItems.length,
    });
    if (error) {
      toast.error("Could not add item");
      return;
    }
    qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
    setPickerOpen(false);
    toast.success(`Added ${item.code}`);
    void checkCompanion(item.category);
  };

  const addCodes = async (codes: string[]) => {
    if (!activeId || !job) return;
    const { data: matches } = await supabase
      .from("line_item_master")
      .select("id, code, name, unit, trade, default_price, category")
      .eq("company_id", job.company_id)
      .in("code", codes);
    if (!matches?.length) {
      toast.warning("Codes not found in catalog");
      return;
    }
    let priceMap: Record<string, number> = {};
    if (job.price_book_id) {
      const { data: prices } = await supabase
        .from("line_item_prices")
        .select("line_item_master_id, unit_price")
        .eq("price_book_id", job.price_book_id)
        .in(
          "line_item_master_id",
          matches.map((m) => m.id),
        );
      priceMap = Object.fromEntries(
        (prices ?? []).map((p) => [p.line_item_master_id, Number(p.unit_price)]),
      );
    }
    const rows = matches.map((m, idx) => ({
      estimate_id: activeId,
      line_item_id: m.id,
      code: m.code,
      name: m.name,
      trade: m.trade as Trade,
      unit: m.unit,
      qty: 1,
      unit_price: priceMap[m.id] ?? Number(m.default_price ?? 0),
      total: priceMap[m.id] ?? Number(m.default_price ?? 0),
      sort_order: localItems.length + idx,
    }));
    const { error } = await supabase.from("estimate_line_items").insert(rows);
    if (error) {
      toast.error("Could not add items");
      return;
    }
    qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
    toast.success(`Added ${rows.length} item${rows.length === 1 ? "" : "s"}`);
  };

  const addCustom = async (draft: CustomItemDraft) => {
    if (!activeId) return;
    const { error } = await supabase.from("estimate_line_items").insert({
      estimate_id: activeId,
      line_item_id: null,
      code: draft.code,
      name: draft.name,
      trade: draft.trade,
      unit: draft.unit,
      qty: draft.qty,
      unit_price: draft.unit_price,
      total: draft.qty * draft.unit_price,
      sort_order: localItems.length,
    });
    if (error) {
      toast.error("Could not add custom item");
      return;
    }
    qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
    toast.success("Custom item added");
  };

  const createTier = async (tier: string) => {
    if (!job || !company) return;
    const { data, error } = await supabase
      .from("estimates")
      .insert({
        job_id: jobId,
        company_id: job.company_id,
        name: tier.charAt(0).toUpperCase() + tier.slice(1),
        tier,
        markup_pct: Number(company.default_markup_pct ?? 10),
        overhead_pct: Number(company.default_overhead_pct ?? 10),
        profit_pct: Number(company.default_profit_pct ?? 10),
        tax_pct: Number(company.default_tax_rate ?? 0),
      })
      .select()
      .single();
    if (error) {
      toast.error("Could not create tier");
      return;
    }
    qc.invalidateQueries({ queryKey: ["estimates", jobId] });
    setActiveId(data.id);
    toast.success(`${tier} tier created`);
  };

  const duplicate = async () => {
    if (!activeEstimate) return;
    const { data: newEst, error } = await supabase
      .from("estimates")
      .insert({
        job_id: jobId,
        company_id: activeEstimate.company_id,
        name: `${activeEstimate.name} (copy)`,
        tier: activeEstimate.tier,
        markup_pct: activeEstimate.markup_pct,
        overhead_pct: activeEstimate.overhead_pct,
        profit_pct: activeEstimate.profit_pct,
        tax_pct: activeEstimate.tax_pct,
      })
      .select()
      .single();
    if (error || !newEst) {
      toast.error("Could not duplicate");
      return;
    }
    if (localItems.length > 0) {
      await supabase.from("estimate_line_items").insert(
        localItems.map((i, idx) => ({
          estimate_id: newEst.id,
          line_item_id: i.line_item_id,
          code: i.code,
          name: i.name,
          trade: i.trade as Trade,
          unit: i.unit,
          qty: i.qty,
          unit_price: i.unit_price,
          total: i.qty * i.unit_price,
          sort_order: idx,
        })),
      );
    }
    qc.invalidateQueries({ queryKey: ["estimates", jobId] });
    setActiveId(newEst.id);
    toast.success("Estimate duplicated");
  };

  const updateStatus = async (status: string) => {
    if (!activeEstimate) return;
    await supabase
      .from("estimates")
      .update({ status: status as never })
      .eq("id", activeEstimate.id);
    qc.invalidateQueries({ queryKey: ["estimates", jobId] });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <TierTabs
          estimates={estimates}
          activeId={activeId}
          onSelect={setActiveId}
          onCreateTier={createTier}
          onDuplicate={duplicate}
        />

        {activeEstimate && (
          <div className="flex items-center gap-3">
            <select
              value={activeEstimate.status}
              onChange={(e) => updateStatus(e.target.value)}
              className="appearance-none rounded-lg border bg-[var(--bg-card)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider outline-none"
              style={{ borderColor: "var(--border)" }}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <StatusBadge status={activeEstimate.status} />
          </div>
        )}

        {companionSuggestion && (
          <CompanionRulesBanner
            suggestion={companionSuggestion}
            onAddCode={(code) => addCodes([code])}
            onAddAll={() => {
              addCodes(companionSuggestion.codes);
              setCompanionSuggestion(null);
            }}
            onDismiss={() => setCompanionSuggestion(null)}
          />
        )}

        <LineItemTable
          items={localItems}
          onPatch={patchItem}
          onDelete={(id) => deleteItem.mutate(id)}
        />

        <div className="space-y-2">
          {pickerOpen ? (
            <AddLineItemCombobox
              priceBookId={job?.price_book_id ?? null}
              onPick={addCatalogItem}
              onClose={() => setPickerOpen(false)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPickerOpen(true)}
                disabled={!activeId}
                className="btn-ghost flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add line item
              </button>
              <button
                onClick={() => setCustomOpen(true)}
                disabled={!activeId}
                className="btn-ghost flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Add custom item
              </button>
            </div>
          )}
        </div>
      </div>

      {activeEstimate && (
        <EstimateTotalsPanel
          jobId={jobId}
          tierLabel={activeEstimate.tier === "original" ? activeEstimate.name : activeEstimate.tier}
          subtotal={subtotal}
          pcts={pcts}
          onPctChange={(patch) => setPcts((p) => ({ ...p, ...patch }))}
          hidePricing={hidePricing}
          onTogglePricing={() => setHidePricing((h) => !h)}
          savedAt={savedAt}
        />
      )}

      <AddCustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={addCustom}
      />
    </div>
  );
}
