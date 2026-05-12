import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type MaterialCategory = { id: string; slug: string; label: string; sort_order: number; company_id: string | null };
export type MaterialItem = {
  id: string; company_id: string | null; category_id: string; supplier_id: string | null;
  slug: string | null; name: string; uom: string; unit_price: number; active: boolean;
  coverage_sq: number | null; coverage_base: string | null;
};
export type Supplier = {
  id: string; name: string; rep_name: string | null; rep_phone: string | null;
  rep_email: string | null; branch: string | null;
};
export type RoofTemplate = {
  id: string; company_id: string | null; slug: string; label: string;
  icon: string | null; inputs: string[]; sort_order: number;
};
export type TemplateMaterialLine = {
  id: string; template_id: string; label: string; default_material_id: string | null;
  formula: any; sort_order: number;
};
export type TemplateLaborLine = {
  id: string; template_id: string; task: string; uom: string; rate: number;
  formula: any; sort_order: number;
};
export type ExtraCost = { label: string; amount: number };
export type JobOrderDraft = {
  id: string; job_id: string; company_id: string;
  template_id: string | null;
  inputs: Record<string, number>;
  material_overrides: Array<{ line_id: string; material_id?: string | null; qty?: number | null; unit_price?: number | null; excluded?: boolean }>;
  labor_overrides: Array<{ line_id: string; qty?: number | null; rate?: number | null }>;
  markup_pct: number; sales_tax_pct: number; notes: string | null;
  dump_cost: number; permit_cost: number; extra_costs: ExtraCost[];
};

export type SnapshotStatus = 'draft' | 'pending_approval' | 'approved' | 'superseded' | 'rejected';
export type JobOrderSnapshot = {
  id: string; job_id: string; company_id: string;
  version_number: number;
  status: SnapshotStatus;
  template_label: string | null;
  inputs: Record<string, number>;
  materials: any[]; labor: any[]; totals: any;
  dump_cost: number; permit_cost: number; extra_costs: ExtraCost[];
  total_squares: number; per_sq_price: number; cost_per_sq: number;
  created_by: string | null; submitted_at: string | null;
  approved_by: string | null; approved_at: string | null; approval_notes: string | null;
  created_at: string; snapshot_date: string;
};

export function useMaterialCategories() {
  return useQuery({
    queryKey: ["material_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as MaterialCategory[];
    },
  });
}

export function useMaterialCatalog() {
  return useQuery({
    queryKey: ["material_catalog"],
    queryFn: async () => {
      const all: MaterialItem[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("material_catalog")
          .select("*")
          .eq("active", true)
          .order("name")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as MaterialItem[];
        all.push(...rows);
        if (rows.length < PAGE) break;
      }
      return all;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["material_suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_suppliers")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });
}

export function useRoofTemplates() {
  return useQuery({
    queryKey: ["roof_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roof_system_templates")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ ...r, inputs: r.inputs ?? [] })) as RoofTemplate[];
    },
  });
}

export function useTemplateLines(templateId: string | null | undefined) {
  return useQuery({
    queryKey: ["template_lines", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const [{ data: mats, error: e1 }, { data: lab, error: e2 }] = await Promise.all([
        supabase
          .from("template_material_lines")
          .select("*")
          .eq("template_id", templateId!)
          .order("sort_order"),
        supabase
          .from("template_labor_lines")
          .select("*")
          .eq("template_id", templateId!)
          .order("sort_order"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return {
        materials: (mats ?? []) as TemplateMaterialLine[],
        labor: (lab ?? []) as TemplateLaborLine[],
      };
    },
  });
}

export function useJobOrderDraft(jobId: string) {
  const { data: company } = useCompany();
  const qc = useQueryClient();

  const draftQ = useQuery({
    queryKey: ["job_order_draft", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_order_drafts")
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) as JobOrderDraft | null;
    },
  });

  const upsert = useMutation({
    mutationFn: async (patch: Partial<JobOrderDraft>) => {
      if (!company?.id) throw new Error("No company");
      const existing = draftQ.data;
      if (existing) {
        const { data, error } = await supabase
          .from("job_order_drafts")
          .update(patch as any)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("job_order_drafts")
        .insert({
          job_id: jobId,
          company_id: company.id,
          inputs: {},
          material_overrides: [],
          labor_overrides: [],
          markup_pct: 35,
          sales_tax_pct: 7,
          ...patch,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job_order_draft", jobId] }),
  });

  return { ...draftQ, upsert };
}

export function useJobOrderSnapshots(jobId: string) {
  return useQuery({
    queryKey: ["job_order_snapshots", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_order_snapshots")
        .select("*")
        .eq("job_id", jobId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as JobOrderSnapshot[];
    },
  });
}

export function useApprovedOrderSnapshot(jobId: string) {
  return useQuery({
    queryKey: ["job_order_snapshot_approved", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_order_snapshots")
        .select("*")
        .eq("job_id", jobId)
        .eq("status", "approved")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as any) as JobOrderSnapshot | null;
    },
  });
}

export function useSnapshotMutations(jobId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["job_order_snapshots", jobId] });
    qc.invalidateQueries({ queryKey: ["job_order_snapshot_approved", jobId] });
    qc.invalidateQueries({ queryKey: ["job_order_draft", jobId] });
  };
  return {
    submit: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc("submit_order_snapshot" as any, { _id: id });
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: async ({ id, note }: { id: string; note?: string }) => {
        const { error } = await supabase.rpc("approve_order_snapshot" as any, { _id: id, _note: note ?? null });
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: async ({ id, note }: { id: string; note?: string }) => {
        const { error } = await supabase.rpc("reject_order_snapshot" as any, { _id: id, _note: note ?? null });
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    rollback: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.rpc("rollback_order_snapshot" as any, { _id: id });
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from("job_order_snapshots").delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    }),
  };
}
