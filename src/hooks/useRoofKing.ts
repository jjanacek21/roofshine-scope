import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

/**
 * True when the signed-in user belongs to a company flagged as Roof King.
 */
export function useIsRoofKing() {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;

  const { data } = useQuery({
    queryKey: ["rk-company-flag", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, is_roof_king")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    isRoofKing: !!data?.is_roof_king || profile?.role === "super_admin",
    companyId,
    loading: !!companyId && data === undefined,
  };
}
