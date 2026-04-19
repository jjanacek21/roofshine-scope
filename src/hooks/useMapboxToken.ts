import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMapboxToken() {
  return useQuery({
    queryKey: ["mapbox-token"],
    staleTime: 60 * 60 * 1000, // 1 hour
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const res = await fetch("/api/mapbox-token", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to load Mapbox token");
      const json = (await res.json()) as { token: string };
      return json.token;
    },
  });
}
