import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFeatures } from "@/hooks/useFeatures";

/**
 * Route-level guard: redirects to "/" when the route's required feature
 * is not granted to the signed-in user's company.
 */
export function RequireFeature({
  feature,
  children,
}: {
  feature: string;
  children: ReactNode;
}) {
  const { can, loading } = useFeatures();
  const navigate = useNavigate();
  const allowed = can(feature);

  useEffect(() => {
    if (!loading && !allowed) navigate({ to: "/" });
  }, [loading, allowed, navigate]);

  if (loading || !allowed) return null;
  return <>{children}</>;
}
