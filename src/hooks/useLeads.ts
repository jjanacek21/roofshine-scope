import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeadRow, LeadContact } from "@/lib/leads";

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      // Supabase caps any single .select() at 1000 rows. Page through with
      // .range() so dashboards/list/map see every lead.
      const PAGE = 1000;
      const all: LeadRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as LeadRow[];
        all.push(...rows);
        if (rows.length < PAGE) break;
      }
      return all;
    },
  });
}

export interface LeadStatusCounts {
  total: number;
  byStatus: Record<string, number>;
  wonValue: number;
}

export function useLeadStats() {
  return useQuery({
    queryKey: ["lead-stats"],
    queryFn: async (): Promise<LeadStatusCounts> => {
      const { count: total, error: totalErr } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });
      if (totalErr) throw totalErr;

      const statuses = [
        "new",
        "contacted",
        "qualified",
        "quoted",
        "report_sent",
        "won",
        "lost",
        "dnc",
      ] as const;
      const results = await Promise.all(
        statuses.map(async (s) => {
          const { count, error } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("status", s);
          if (error) throw error;
          return [s, count ?? 0] as const;
        }),
      );
      const byStatus: Record<string, number> = {};
      for (const [s, c] of results) byStatus[s] = c;

      let wonValue = 0;
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("leads")
          .select("estimated_value")
          .eq("status", "won")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data ?? [];
        wonValue += rows.reduce((a, r) => a + Number(r.estimated_value ?? 0), 0);
        if (rows.length < PAGE) break;
      }

      return { total: total ?? 0, byStatus, wonValue };
    },
  });
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: ["lead", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LeadRow | null;
    },
  });
}

export function useLeadContacts(leadId: string | null) {
  return useQuery({
    queryKey: ["lead-contacts", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from("lead_contacts")
        .select("*")
        .eq("lead_id", leadId!)
        .order("sort_order");
      if (error) throw error;
      const ids = (contacts ?? []).map((c) => c.id);
      if (ids.length === 0) return [] as LeadContact[];
      const [{ data: phones }, { data: emails }] = await Promise.all([
        supabase.from("lead_contact_phones").select("*").in("contact_id", ids),
        supabase.from("lead_contact_emails").select("*").in("contact_id", ids),
      ]);
      return (contacts ?? []).map((c) => ({
        ...c,
        phones: (phones ?? []).filter((p) => p.contact_id === c.id),
        emails: (emails ?? []).filter((e) => e.contact_id === c.id),
      })) as unknown as LeadContact[];
    },
  });
}

export function useLeadActivities(leadId: string | null) {
  return useQuery({
    queryKey: ["lead-activities", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLeadNotes(leadId: string | null) {
  return useQuery({
    queryKey: ["lead-notes", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
