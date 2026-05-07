import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, email, first_name, last_name, role, company_id, avatar_url, bio, title, mobile_phone, office_phone, card_slug, onboarding_completed_at",
        )
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });
}

export function useIsCompanyAdmin() {
  const { data } = useProfile();
  return data?.role === "owner" || data?.role === "admin" || data?.role === "super_admin";
}
