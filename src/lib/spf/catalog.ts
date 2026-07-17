import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  hydrateCatalog,
  type Product,
  type Detail,
  type MethodKey,
  type ProductRole,
  type ScopeKey,
  type SpfFields,
} from "./data";

export type SpfProductRow = {
  id: string;
  name: string;
  solids_pct: number;
  cost_per_gal: number;
  default_mils: number;
  default_method: MethodKey;
  role: ProductRole;
  sort_order: number;
  active: boolean;
};

export type SpfDetailRow = {
  id: string;
  label: string;
  unit: "ea" | "lf" | "ls";
  default_qty: number;
  unit_cost: number;
  sort_order: number;
  active: boolean;
};

export type SpfStackRow = {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  active: boolean;
};

export type SpfStackLayerRow = {
  id: string;
  stack_id: string;
  product_id: string;
  scope: ScopeKey;
  amount: number;
  method: MethodKey;
  mils: number;
  sort_order: number;
  on_by_default: boolean;
};

export type SpfFieldDefaultRow = {
  field_key: string;
  label: string;
  group_key: string;
  value_text: string;
  simple_mode: boolean;
  sort_order: number;
};

export type SpfCalcSettingsRow = {
  default_mode: "simple" | "detailed";
};

export type SpfCatalog = {
  products: SpfProductRow[];
  details: SpfDetailRow[];
  stacks: SpfStackRow[];
  stackLayers: SpfStackLayerRow[];
  fieldDefaults: SpfFieldDefaultRow[];
  settings: SpfCalcSettingsRow;
};

export async function fetchSpfCatalog(): Promise<SpfCatalog> {
  const [products, details, stacks, stackLayers, fieldDefaults, settings] = await Promise.all([
    supabase.from("spf_products").select("*").order("sort_order"),
    supabase.from("spf_details").select("*").order("sort_order"),
    supabase.from("spf_stacks").select("*").order("sort_order"),
    supabase.from("spf_stack_layers").select("*").order("sort_order"),
    supabase.from("spf_field_defaults").select("*").order("sort_order"),
    supabase.from("spf_calc_settings").select("default_mode").maybeSingle(),
  ]);
  if (products.error) throw products.error;
  return {
    products: (products.data ?? []) as SpfProductRow[],
    details: (details.data ?? []) as SpfDetailRow[],
    stacks: (stacks.data ?? []) as SpfStackRow[],
    stackLayers: (stackLayers.data ?? []) as SpfStackLayerRow[],
    fieldDefaults: (fieldDefaults.data ?? []) as SpfFieldDefaultRow[],
    settings: ((settings.data as SpfCalcSettingsRow | null) ?? { default_mode: "detailed" }),
  };
}

// Parse "1.5" → 1.5, "1" → 1, but keep strings for select-value keys.
function coerceFieldValue(key: string, text: string): unknown {
  if (text === "" || text == null) return text;
  // Fields whose SpfFields type is `string` — keep as-is (selects, project text).
  const stringKeys = new Set([
    "p_name", "p_addr", "p_geo", "p_slope",
    "e_deck", "e_surf", "e_tear", "e_prep", "e_rustm",
    "a_method", "a_occ", "a_shift",
    "f_on", "f_dens", "f_amb", "f_tex",
    "r_type",
    "s_eng", "s_pbasis", "s_war",
  ]);
  if (stringKeys.has(key)) return text;
  const n = Number(text);
  return Number.isFinite(n) ? n : text;
}

export function catalogToLegacyShapes(cat: SpfCatalog) {
  const products: Product[] = cat.products
    .filter((p) => p.active)
    .map((p) => [p.name, p.solids_pct, p.cost_per_gal, p.default_mils, p.default_method, p.role] as Product);

  const details: Detail[] = cat.details
    .filter((d) => d.active)
    .map((d) => [d.label, d.unit, d.default_qty, d.unit_cost] as Detail);

  // Product id → active-index (after filter above)
  const idToIdx = new Map<string, number>();
  cat.products.filter((p) => p.active).forEach((p, i) => idToIdx.set(p.id, i));

  const stackKeyById = new Map<string, string>();
  cat.stacks.forEach((s) => stackKeyById.set(s.id, s.key));

  const stacks: Record<string, ReturnType<typeof buildStackTemplate>[number][]> = {};
  for (const s of cat.stacks.filter((s) => s.active)) {
    stacks[s.key] = [];
  }
  for (const l of cat.stackLayers) {
    const key = stackKeyById.get(l.stack_id);
    if (!key || !(key in stacks)) continue;
    const pi = idToIdx.get(l.product_id);
    if (pi == null) continue;
    stacks[key].push([l.on_by_default ? 1 : 0, pi, null, l.scope, l.amount, l.method, l.mils, null, null, null]);
  }

  const fieldDefaults: Partial<SpfFields> = {};
  for (const f of cat.fieldDefaults) {
    (fieldDefaults as Record<string, unknown>)[f.field_key] = coerceFieldValue(f.field_key, f.value_text);
  }

  return { products, details, stacks, fieldDefaults };
}

// Placeholder helper to give TS a return type name for the stacks tuple.
function buildStackTemplate() {
  return [] as [number, number, null, ScopeKey, number, MethodKey, number, null, null, null][];
}

export function useSpfCatalog() {
  return useQuery({
    queryKey: ["spf-catalog"],
    queryFn: fetchSpfCatalog,
    staleTime: 5 * 60_000,
  });
}

/**
 * Hydrates the module-level PRODUCTS/DETAILS/STACKS/FIELD_DEFAULTS arrays with
 * the DB catalog. Returns a `ready` flag once hydration completes so the
 * calculator can wait before mounting (otherwise the engine reads stale seeds).
 */
export function useHydratedSpfCatalog() {
  const q = useSpfCatalog();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    const legacy = catalogToLegacyShapes(q.data);
    hydrateCatalog(legacy);
    setReady(true);
  }, [q.data]);

  return { ...q, ready, catalog: q.data };
}
