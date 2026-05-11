import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export type CompanyBrand = {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export function useCompany() {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;
  return useQuery({
    queryKey: ["my-company", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<CompanyBrand | null> => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, logo_url, phone, email, website")
        .eq("id", companyId!)
        .maybeSingle();
      return (data as CompanyBrand) ?? null;
    },
  });
}
