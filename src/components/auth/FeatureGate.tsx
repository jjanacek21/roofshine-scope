import type { ReactNode } from "react";
import { useFeatures } from "@/hooks/useFeatures";

/**
 * Renders children only when the signed-in user's company has `feature`.
 * While the context is loading nothing is rendered, to avoid a flash.
 */
export function FeatureGate({
  feature,
  fallback = null,
  children,
}: {
  feature: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, loading } = useFeatures();
  if (loading) return null;
  return <>{can(feature) ? children : fallback}</>;
}
