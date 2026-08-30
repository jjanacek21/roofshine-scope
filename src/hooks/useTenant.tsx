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
  sign_base_url: string | null;
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
      const read = async () =>
        await supabase
          .from("tenant_users")
          .select("*, tenants(*)")
          .eq("user_id", user!.id)
          .eq("is_active", true)
          .order("created_at")
          .limit(1)
          .maybeSingle();

      let { data: tu, error } = await read();
      if (error) throw error;

      /* A contract belongs to a tenant, and until now a tenant could only be
         created by a super admin — so most people, including company owners,
         hit "Contracts not enabled" and could never sign anything. A tenant is
         just the contract-facing face of a company, so provision one from the
         company this user already belongs to and read again. */
      if (!tu) {
        /* Cast because types.ts is generated and does not know this function;
           hand-editing it would be undone on the next regeneration. */
        const rpc = supabase.rpc as unknown as (
          fn: string,
        ) => Promise<{ error: unknown }>;
        const { error: rpcErr } = await rpc("ensure_contract_tenant");
        if (!rpcErr) {
          const retry = await read();
          if (!retry.error) tu = retry.data;
        } else {
          console.warn("could not provision a contract tenant", rpcErr);
        }
      }

      if (!tu) return { tenant: null as Tenant | null, tenantUser: null as TenantUser | null };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { tenants, ...tenantUser } = tu as any;
      return { tenant: tenants as Tenant, tenantUser: tenantUser as TenantUser };
    },
  });
}
