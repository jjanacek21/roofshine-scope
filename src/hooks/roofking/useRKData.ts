import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RKAccount, RKProperty, RKTicket, RKFormTemplate } from "@/lib/roofking/types";

export function useRKAccounts(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["rk", "accounts", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<RKAccount[]> => {
      const { data, error } = await supabase
        .from("rk_accounts")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as RKAccount[];
    },
  });
}

export function useRKProperties(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["rk", "properties", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<RKProperty[]> => {
      const { data, error } = await supabase
        .from("rk_properties")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as RKProperty[];
    },
  });
}

export function useRKTickets(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["rk", "tickets", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<RKTicket[]> => {
      const { data, error } = await supabase
        .from("rk_tickets")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RKTicket[];
    },
  });
}

export function useRKFormTemplates(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["rk", "forms", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<RKFormTemplate[]> => {
      const { data, error } = await supabase
        .from("rk_form_templates")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as RKFormTemplate[];
    },
  });
}
