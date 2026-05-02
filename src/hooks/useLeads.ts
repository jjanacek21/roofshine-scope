import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeadRow, LeadContact } from "@/lib/leads";

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadRow[];
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
