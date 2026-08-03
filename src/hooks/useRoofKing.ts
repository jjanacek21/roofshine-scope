import { useCompanyFeatures } from "@/hooks/useCompanyFeatures";

/**
 * True when the signed-in user's company has the Roof King feature enabled.
 */
export function useIsRoofKing() {
  const { roofKing, companyId, loading } = useCompanyFeatures();
  return { isRoofKing: roofKing, companyId, loading };
}
