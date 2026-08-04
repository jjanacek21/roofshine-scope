import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Layers, FileDown, Ruler } from "lucide-react";
import { ApplyMeasurementsDialog } from "@/components/estimate/ApplyMeasurementsDialog";
import { deriveQtyForItem, type SavedMeasurement } from "@/lib/estimate-measurement-fill";
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
import { MacroPicker, type MacroPickerItem } from "@/components/estimate/MacroPicker";
import { AISuggestionsPanel } from "@/components/estimate/AISuggestionsPanel";
import type { Trade } from "@/lib/trades";
import { unitCost, lineTotal } from "@/lib/estimate-document";
import {
  XactimateReport,
  type CoverMeta,
  type ReportProfile,
} from "@/components/estimate/XactimateReport";
import { ReportSetupPanel } from "@/components/estimate/ReportSetupPanel";
import type { ReportNote, SectionMeasurements } from "@/lib/xact-report";
import { generateEstimatePdf } from "@/lib/estimate-pdf";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/jobs/$id/estimate")({
  validateSearch: z.object({
    codes: z.string().optional(),
    qtys: z.string().optional(),
    units: z.string().optional(),
  }),
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
  use_manual_total: boolean;
  manual_total: number | null;
  notes: string | null;
  estimate_number?: string | null;
  type_of_estimate?: string | null;
  price_list_code?: string | null;
  deductible?: number | null;
  coverage_label?: string | null;
  report_meta?: Record<string, unknown> | null;
  report_notes?: ReportNote[] | null;
};


const EMPTY_ITEMS: LineItem[] = [];

function JobEstimate() {
  const { id: jobId } = Route.useParams();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [macroOpen, setMacroOpen] = useState(false);
  const [companionSuggestion, setCompanionSuggestion] = useState<CompanionSuggestion | null>(
    null,
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [view, setView] = useState<"edit" | "document">("edit");
  const docRef = useRef<HTMLDivElement>(null);
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
        .select(
          "name, logo_url, address, phone, email, website, report_profile, default_markup_pct, default_overhead_pct, default_profit_pct, default_tax_rate",
        )
        .eq("id", job!.company_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["estimate-client", job?.client_id],
    enabled: !!job?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("name, email, phone, address")
        .eq("id", job!.client_id!)
        .maybeSingle();
      return data;
    },
  });

  // Roof measurement block printed under the first section of the report
  const { data: measurement } = useQuery({
    queryKey: ["estimate-measurement", job?.property_id],
    enabled: !!job?.property_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("roof_measurements")
        .select(
          "total_area_sqft, squares, waste_pct, eaves_lf, rakes_lf, ridges_lf, hips_lf, valleys_lf, drip_edge_lf, step_flashing_lf, wall_flashing_lf, gutters_lf, parapet_wall_lf, transition_lf",
        )
        .eq("property_id", job!.property_id!)
        .maybeSingle();
      return data;
    },
  });



  // Estimates list
  const { data: estimates } = useQuery({
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
    if (!job || !estimates || ensuredRef.current) return;
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
            markup_pct: Number(company.default_markup_pct ?? 0),
            overhead_pct: Number(company.default_overhead_pct ?? 0),
            profit_pct: Number(company.default_profit_pct ?? 0),
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

  const activeEstimate = estimates?.find((e) => e.id === activeId) ?? null;
  const activeEstimateId = activeEstimate?.id ?? null;

  // Line items for active estimate
  const { data: itemsData } = useQuery({
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
  // Stable identity: a fresh [] every render would retrigger the sync effect forever.
  const items = itemsData ?? EMPTY_ITEMS;

  // Local optimistic copy so debounced updates feel snappy
  const [localItems, setLocalItems] = useState<LineItem[]>([]);
  useEffect(() => {
    setLocalItems((prev) => (prev === items ? prev : items));
  }, [items]);


  const subtotal = useMemo(
    () => localItems.reduce((s, i) => s + lineTotal(i), 0),
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
  const [useManualTotal, setUseManualTotal] = useState(false);
  const [manualTotal, setManualTotal] = useState<number>(0);
  useEffect(() => {
    if (activeEstimate) {
      setPcts({
        markup_pct: Number(activeEstimate.markup_pct ?? 0),
        overhead_pct: Number(activeEstimate.overhead_pct ?? 0),
        profit_pct: Number(activeEstimate.profit_pct ?? 0),
        tax_pct: Number(activeEstimate.tax_pct ?? 0),
      });
      setHidePricing(Boolean(activeEstimate.hide_pricing));
      setUseManualTotal(Boolean(activeEstimate.use_manual_total));
      setManualTotal(Number(activeEstimate.manual_total ?? 0));
      setDeductible(Number(activeEstimate.deductible ?? 0));
      setReportMeta((activeEstimate.report_meta ?? {}) as CoverMeta);
      setReportNotes(
        Array.isArray(activeEstimate.report_notes) ? (activeEstimate.report_notes as ReportNote[]) : [],
      );
    }
    // Only hydrate editable fields when switching estimates. Refetches after autosave
    // should not overwrite the user's in-progress percentage edits or re-trigger saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEstimateId]);

  // Carrier report fields (cover sheet, deductible, notes)
  const [deductible, setDeductible] = useState(0);
  const [reportMeta, setReportMeta] = useState<CoverMeta>({});
  const [reportNotes, setReportNotes] = useState<ReportNote[]>([]);
  const reportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportHydrated = useRef<string | null>(null);
  useEffect(() => {
    if (!activeEstimateId) return;
    if (reportHydrated.current !== activeEstimateId) {
      reportHydrated.current = activeEstimateId;
      return; // skip the save triggered by hydration
    }
    if (reportTimer.current) clearTimeout(reportTimer.current);
    reportTimer.current = setTimeout(async () => {
      await supabase
        .from("estimates")
        .update({
          deductible,
          report_meta: reportMeta as never,
          report_notes: reportNotes as never,
        } as never)
        .eq("id", activeEstimateId);
      setSavedAt(Date.now());
    }, 600);
    return () => {
      if (reportTimer.current) clearTimeout(reportTimer.current);
    };
  }, [deductible, reportMeta, reportNotes, activeEstimateId]);


  // Debounced save of estimate header (pcts + totals)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeEstimateId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const markup = (subtotal * pcts.markup_pct) / 100;
      const overhead = (subtotal * pcts.overhead_pct) / 100;
      const profit = (subtotal * pcts.profit_pct) / 100;
      const beforeTax = subtotal + markup + overhead + profit;
      const tax = (beforeTax * pcts.tax_pct) / 100;
      const calcTotal = beforeTax + tax;
      const effectiveTotal = useManualTotal ? Number(manualTotal) || 0 : calcTotal;
      await supabase
        .from("estimates")
        .update({
          markup_pct: pcts.markup_pct,
          overhead_pct: pcts.overhead_pct,
          profit_pct: pcts.profit_pct,
          tax_pct: pcts.tax_pct,
          hide_pricing: hidePricing,
          use_manual_total: useManualTotal,
          manual_total: useManualTotal ? Number(manualTotal) || 0 : null,
          subtotal,
          tax,
          total: effectiveTotal,
        } as any)
        .eq("id", activeEstimateId);
      // bump job total as the active tier price (simple)
      await supabase.from("jobs").update({ total_estimate: effectiveTotal }).eq("id", jobId);
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: ["estimates", jobId] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [pcts, hidePricing, useManualTotal, manualTotal, subtotal, activeEstimateId, jobId, qc]);

  // Item patch (debounced per-item)
  const itemTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patchItem = (itemId: string, patch: Partial<LineItem>) => {
    setLocalItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const next = { ...i, ...patch };
        next.total = next.qty * unitCost(next);
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
        remove_price?: number;
        replace_price?: number;
        note?: string | null;
        area?: string;
        category?: string | null;
        subgroup?: string | null;
        depreciation_pct?: number | null;
        not_yet_incurred?: boolean;
      } = {};
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.unit !== undefined) updates.unit = patch.unit;
      if (patch.qty !== undefined) updates.qty = patch.qty;
      if (patch.unit_price !== undefined) updates.unit_price = patch.unit_price;
      if (patch.remove_price !== undefined) updates.remove_price = Number(patch.remove_price) || 0;
      if (patch.replace_price !== undefined) updates.replace_price = Number(patch.replace_price) || 0;
      if (patch.note !== undefined) updates.note = patch.note ?? null;
      if (patch.area !== undefined) updates.area = patch.area || "Main Level";
      if (patch.category !== undefined) updates.category = patch.category ?? null;
      if (patch.subgroup !== undefined) updates.subgroup = patch.subgroup ?? null;
      if (patch.depreciation_pct !== undefined)
        updates.depreciation_pct = Number(patch.depreciation_pct) || 0;
      if (patch.not_yet_incurred !== undefined)
        updates.not_yet_incurred = Boolean(patch.not_yet_incurred);
      if (merged) updates.total = merged.qty * unitCost(merged);

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

  const deleteItems = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("estimate_line_items").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
      toast.success(`${count ?? 0} items removed`);
    },
    onError: () => toast.error("Could not delete items"),
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
      category: (item as { category?: string | null }).category ?? null,
      subgroup: (item as { subgroup?: string | null }).subgroup ?? null,
      sort_order: localItems.length,
    });
    if (error) {
      toast.error("Could not add item");
      return;
    }
    qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
    toast.success(`Added ${item.code}`);
    void checkCompanion(item.category);
  };

  const addCodes = async (
    input: Array<string | { code: string; qty?: number; unit?: string }>,
    source: "manual" | "ai_photo" = "manual",
  ) => {
    if (!activeId || !job) return;
    const normalized = input.map((x) =>
      typeof x === "string" ? { code: x, qty: 1, unit: undefined as string | undefined } : { code: x.code, qty: x.qty ?? 1, unit: x.unit },
    );
    const codes = normalized.map((n) => n.code);
    const { data: matches } = await supabase
      .from("line_item_master")
      .select("id, code, name, unit, trade, default_price, category, subgroup, remove_price, replace_price")
      .or(`company_id.eq.${job.company_id},company_id.is.null`)
      .in("code", codes);
    if (!matches?.length) {
      toast.warning(`0/${codes.length} codes found in catalog — nothing added`, {
        description: codes.slice(0, 5).join(", ") + (codes.length > 5 ? "…" : ""),
      });
      return;
    }
    const matchedCodes = new Set(matches.map((m) => m.code));
    const missingCodes = codes.filter((c) => !matchedCodes.has(c));
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
    const rows = matches.map((m, idx) => {
      const norm = normalized.find((n) => n.code === m.code);
      const qty = norm?.qty ?? 1;
      const unit_price = priceMap[m.id] ?? Number(m.default_price ?? 0);
      return {
        estimate_id: activeId,
        line_item_id: m.id,
        code: m.code,
        name: m.name,
        trade: m.trade as Trade,
        unit: norm?.unit ?? m.unit,
        qty,
        unit_price,
        total: qty * unit_price,
        category: (m as { category?: string | null }).category ?? null,
        subgroup: (m as { subgroup?: string | null }).subgroup ?? null,
        source,
        sort_order: localItems.length + idx,
      };
    });
    const { error } = await supabase.from("estimate_line_items").insert(rows);
    if (error) {
      toast.error("Could not add items");
      return;
    }
    qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
    toast.success(`Added ${rows.length} item${rows.length === 1 ? "" : "s"}`, {
      description:
        missingCodes.length > 0
          ? `${missingCodes.length} code${missingCodes.length === 1 ? "" : "s"} not in catalog — skipped: ${missingCodes.slice(0, 3).join(", ")}${missingCodes.length > 3 ? "…" : ""}`
          : undefined,
    });
  };

  // Apply ?codes=... (and optional ?qtys= / ?units=) from search params
  useEffect(() => {
    if (codesAppliedRef.current) return;
    if (!activeId || !search.codes) return;
    const codes = search.codes.split(",").map((c: string) => c.trim()).filter(Boolean);
    if (codes.length === 0) return;
    const qtys = search.qtys?.split(",").map((q: string) => Number(q)) ?? [];
    const units = search.units?.split(",").map((u: string) => decodeURIComponent(u)) ?? [];
    const input = codes.map((code: string, i: number) => ({
      code,
      qty: Number.isFinite(qtys[i]) && qtys[i] > 0 ? qtys[i] : 1,
      unit: units[i] || undefined,
    }));
    codesAppliedRef.current = true;
    addCodes(input, "ai_photo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, search.codes, search.qtys, search.units]);

  const insertMacro = async (macroItems: MacroPickerItem[], macroName: string) => {
    if (!activeId) return;
    const rows = macroItems.map((it, idx) => ({
      estimate_id: activeId,
      line_item_id: it.line_item_master_id,
      code: it.code,
      name: it.name,
      trade: it.trade as Trade,
      unit: it.unit,
      qty: it.qty,
      unit_price: it.unit_price,
      total: it.qty * it.unit_price,
      source: "macro",
      sort_order: localItems.length + idx,
    }));
    const { error } = await supabase.from("estimate_line_items").insert(rows);
    if (error) {
      toast.error("Could not insert macro");
      return;
    }
    qc.invalidateQueries({ queryKey: ["estimate-items", activeId] });
    toast.success(`Inserted "${macroName}" (${rows.length} items)`);
    setMacroOpen(false);
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
        markup_pct: Number(company.default_markup_pct ?? 0),
        overhead_pct: Number(company.default_overhead_pct ?? 0),
        profit_pct: Number(company.default_profit_pct ?? 0),
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
          total: i.qty * unitCost(i),
          remove_price: Number(i.remove_price ?? 0),
          replace_price: Number(i.replace_price ?? 0),
          note: i.note ?? null,
          area: i.area ?? "Main Level",
          category: i.category ?? null,
          subgroup: i.subgroup ?? null,
          sort_order: idx,
        })),
      );
    }
    qc.invalidateQueries({ queryKey: ["estimates", jobId] });
    setActiveId(newEst.id);
    toast.success("Estimate duplicated");
  };

  const exportPdf = async () => {
    if (!docRef.current) return;
    try {
      await generateEstimatePdf(
        docRef.current,
        `estimate-${activeEstimate?.estimate_number ?? activeEstimate?.name ?? "draft"}.pdf`,
      );
    } catch {
      toast.error("Could not export PDF");
    }
  };

  const updateStatus = async (status: string) => {
    if (!activeEstimate) return;
    await supabase
      .from("estimates")
      .update({ status: status as never })
      .eq("id", activeEstimate.id);
    qc.invalidateQueries({ queryKey: ["estimates", jobId] });
  };

  // Company branding for the carrier report letterhead / legal blocks
  const rp = (company?.report_profile ?? {}) as Record<string, string | null>;
  const reportProfile: ReportProfile = {
    companyName: company?.name ?? "Company",
    logoUrl: company?.logo_url ?? null,
    addressLine1: rp.address_line1 ?? company?.address ?? null,
    addressLine2: rp.address_line2 ?? null,
    businessPhone: rp.business_phone ?? company?.phone ?? null,
    claimsEmail: rp.claims_email ?? company?.email ?? null,
    website: company?.website ?? null,
    estimatorName: rp.estimator_name ?? null,
    estimatorPosition: rp.estimator_position ?? null,
    estimatorLicense: rp.estimator_license ?? null,
    legalStatute: rp.legal_statute ?? null,
    legalNotice: rp.legal_notice ?? null,
    fraudWarning: rp.fraud_warning ?? null,
  };

  const coverMeta: CoverMeta = {
    ...reportMeta,
    estimateName: reportMeta.estimateName || activeEstimate?.estimate_number || activeEstimate?.name || "Estimate",
    coverageLabel: reportMeta.coverageLabel || activeEstimate?.coverage_label || "Coverage A - Dwelling",
    insuredName: reportMeta.insuredName || client?.name || job?.name || null,
    insuredPhone: reportMeta.insuredPhone || client?.phone || null,
    insuredEmail: reportMeta.insuredEmail || client?.email || null,
    homeAddress: reportMeta.homeAddress || client?.address || job?.property_address || null,
    propertyAddress: reportMeta.propertyAddress || job?.property_address || null,
    claimNumber: reportMeta.claimNumber || job?.claim_number || null,
    claimRepCompany: reportMeta.claimRepCompany || job?.insurance_carrier || null,
    priceListCode: reportMeta.priceListCode || activeEstimate?.price_list_code || null,
    typeOfLoss: reportMeta.typeOfLoss || activeEstimate?.type_of_estimate || null,
    dateEntered: reportMeta.dateEntered || format(new Date(), "M/d/yyyy"),
    reportDate: format(new Date(), "M/d/yyyy"),
  };

  const firstArea = localItems[0]?.area || "Main Level";
  const sectionMeasurements: Record<string, SectionMeasurements> = measurement
    ? {
        [firstArea]: {
          surfaceArea: Number(measurement.total_area_sqft ?? 0),
          squares: Number(measurement.squares ?? 0),
          perimeter:
            Number(measurement.eaves_lf ?? 0) + Number(measurement.rakes_lf ?? 0),
          ridge: Number(measurement.ridges_lf ?? 0),
          hip: Number(measurement.hips_lf ?? 0),
          valley: Number(measurement.valleys_lf ?? 0),
        },
      }
    : {};


  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <TierTabs
          estimates={estimates ?? []}
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

        <AISuggestionsPanel jobId={jobId} activeEstimateId={activeId} />

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setView("edit")}
              className={`rounded-md px-3 py-1 text-[12px] font-semibold ${view === "edit" ? "bg-[var(--bg-hover)]" : "text-muted-foreground"}`}
            >
              Edit
            </button>
            <button
              onClick={() => setView("document")}
              className={`rounded-md px-3 py-1 text-[12px] font-semibold ${view === "document" ? "bg-[var(--bg-hover)]" : "text-muted-foreground"}`}
            >
              Carrier report
            </button>
          </div>
          {view === "document" && (
            <button
              onClick={exportPdf}
              className="btn-ghost flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold"
            >
              <FileDown className="h-3.5 w-3.5" /> Export PDF
            </button>
          )}
        </div>

        {view === "document" && (
          <ReportSetupPanel
            meta={reportMeta}
            onMetaChange={(patch) => setReportMeta((m) => ({ ...m, ...patch }))}
            deductible={deductible}
            onDeductibleChange={setDeductible}
            notes={reportNotes}
            onNotesChange={setReportNotes}
          />
        )}

        {view === "edit" ? (
          <LineItemTable
            items={localItems}
            onPatch={patchItem}
            onDelete={(id) => deleteItem.mutate(id)}
            onDeleteMany={(ids) => deleteItems.mutate(ids)}
            taxPct={pcts.tax_pct}
          />
        ) : (
          <div ref={docRef} className="overflow-x-auto">
            <XactimateReport
              profile={reportProfile}
              meta={coverMeta}
              items={localItems.map((i) => ({
                id: i.id,
                code: i.code,
                name: i.name,
                unit: i.unit,
                qty: Number(i.qty ?? 0),
                unit_price: unitCost(i),
                depreciation_pct: i.depreciation_pct ?? null,
                depreciation_amount: i.depreciation_amount ?? null,
                depreciation_recoverable: i.depreciation_recoverable ?? true,
                not_yet_incurred: Boolean(i.not_yet_incurred),
                note: i.note,
                category: i.category,
                area: i.area,
              }))}
              taxPct={pcts.tax_pct}
              deductible={deductible}
              notes={reportNotes}
              measurements={sectionMeasurements}
            />
          </div>
        )}


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
                onClick={() => setMacroOpen(true)}
                disabled={!activeId}
                className="btn-ghost flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold disabled:opacity-50"
              >
                <Layers className="h-3.5 w-3.5" />
                Insert macro
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
          useManualTotal={useManualTotal}
          onToggleManualTotal={() => setUseManualTotal((v) => !v)}
          manualTotal={manualTotal}
          onManualTotalChange={(v) => setManualTotal(v)}
          savedAt={savedAt}
        />
      )}

      <AddCustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={addCustom}
      />

      {macroOpen && job?.company_id && (
        <MacroPicker
          companyId={job.company_id}
          onPick={insertMacro}
          onClose={() => setMacroOpen(false)}
        />
      )}
    </div>
  );
}
