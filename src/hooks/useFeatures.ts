import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CompanyContext = {
  company_id: string | null;
  role: string | null;
  is_super_admin: boolean;
  features: Record<string, boolean>;
};

const EMPTY: CompanyContext = {
  company_id: null,
  role: null,
  is_super_admin: false,
  features: {},
};

/**
 * Per-company feature entitlements, resolved server-side by
 * public.company_my_context(). Super admins resolve every key to true.
 */
export function useFeatures() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["company-my-context", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CompanyContext> => {
      const { data, error } = await supabase.rpc("company_my_context");
      if (error) throw error;
      return { ...EMPTY, ...((data as unknown as CompanyContext) ?? {}) };
    },
  });

  const ctx = data ?? EMPTY;
  const loading = !!user?.id && isLoading;

  function can(key: string): boolean {
    if (ctx.is_super_admin) return true;
    return ctx.features?.[key] === true;
  }

  return { ...ctx, can, loading };
}
