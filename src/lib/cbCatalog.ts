import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CbScope = "exterior" | "roof" | "interior";

export interface CbCatalogItem {
  item_key: string;
  label: string;
  group_name: string;
  unit: string | null;
  sort_order: number;
}

export interface CbCatalogGroup {
  group_name: string;
  items: CbCatalogItem[];
}

/** Checklists are data, never hardcoded — everything comes from cb_item_catalog. */
export function useCbCatalog(scope: CbScope) {
  return useQuery({
    queryKey: ["cb-catalog", scope],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<CbCatalogGroup[]> => {
      const { data, error } = await supabase
        .from("cb_item_catalog")
        .select("item_key, label, group_name, unit, sort_order")
        .eq("scope", scope)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as CbCatalogItem[];
      const groups: CbCatalogGroup[] = [];
      for (const row of rows) {
        let g = groups.find((x) => x.group_name === row.group_name);
        if (!g) {
          g = { group_name: row.group_name, items: [] };
          groups.push(g);
        }
        g.items.push(row);
      }
      return groups;
    },
  });
}
