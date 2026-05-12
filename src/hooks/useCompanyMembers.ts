import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export type CompanyMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
};

export function memberName(m: Pick<CompanyMember, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!m) return "—";
  const n = `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim();
  return n || m.email || "—";
}

export function useCompanyMembers() {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;
  return useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CompanyMember[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, role")
        .eq("company_id", companyId!)
        .order("first_name", { ascending: true });
      return (data ?? []) as CompanyMember[];
    },
  });
}
