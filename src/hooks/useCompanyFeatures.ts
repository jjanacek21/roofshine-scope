import { useFeatures } from "@/hooks/useFeatures";

export type CompanyFeatures = {
  doorToDoor: boolean;
  stormIntel: boolean;
  roofKing: boolean;
  companyId: string | null;
  loading: boolean;
};

/**
 * Thin shim over the feature entitlement system (useFeatures).
 * Kept so existing call sites keep working — prefer useFeatures() in new code.
 */
export function useCompanyFeatures(): CompanyFeatures {
  const { can, company_id, loading } = useFeatures();
  return {
    doorToDoor: can("door_to_door"),
    stormIntel: can("storm_intel"),
    roofKing: can("commercial"),
    companyId: company_id,
    loading,
  };
}
