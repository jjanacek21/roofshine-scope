import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export type CompanyFeatures = {
  doorToDoor: boolean;
  stormIntel: boolean;
  roofKing: boolean;
  companyId: string | null;
  loading: boolean;
};

/**
 * Per-company feature switches, managed in the admin portal
 * (Admin → Companies → Manage → Features).
 * Super admins always see everything.
 */
export function useCompanyFeatures(): CompanyFeatures {
  const { data: profile } = useProfile();
  const companyId = profile?.company_id ?? null;
  const isSuperAdmin = profile?.role === "super_admin";

  const { data, isLoading } = useQuery({
    queryKey: ["company-features", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, is_roof_king, feature_door_to_door, feature_storm_intel, feature_roof_king")
        .eq("id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    doorToDoor: isSuperAdmin || !!data?.feature_door_to_door,
    stormIntel: isSuperAdmin || !!data?.feature_storm_intel,
    roofKing: isSuperAdmin || !!data?.feature_roof_king || !!data?.is_roof_king,
    companyId,
    loading: !!companyId && isLoading,
  };
}
