import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Tenant = {
  id: string;
  slug: string;
  company_name: string;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_web: string | null;
  legal_addendum_url: string | null;
  logo_base64: string | null;
  accent_color: string;
  accent_color_dark: string;
  jurisdiction_state: string;
  is_active: boolean;
};

export type TenantUser = {
  id: string;
  tenant_id: string;
  user_id: string;
  rep_slug: string;
  rep_name: string;
  rep_title: string | null;
  rep_phone: string | null;
  rep_email: string | null;
  is_active: boolean;
};

export function useTenant() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-tenant", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: tu, error } = await supabase
        .from("tenant_users")
        .select("*, tenants(*)")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!tu) return { tenant: null as Tenant | null, tenantUser: null as TenantUser | null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { tenants, ...tenantUser } = tu as any;
      return { tenant: tenants as Tenant, tenantUser: tenantUser as TenantUser };
    },
  });
}
