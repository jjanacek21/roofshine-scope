/**
 * Jurisdiction code rules.
 *
 * Rule sets are resolved from the property address — state, and county where
 * it matters (Florida differs inside the high velocity hurricane zone versus
 * the rest of the state). Rules are applied AFTER macro/assembly expansion and
 * every injected line carries its code_reference so an adjuster can see why it
 * is on the estimate.
 *
 * The Florida rule set ships EMPTY on purpose — the real list comes from
 * actual carrier estimates.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CodeRuleSet {
  id: string;
  state: string;
  county: string | null;
  name: string;
  effective_date: string | null;
  notes: string | null;
}

export interface CodeRuleItem {
  id: string;
  rule_set_id: string;
  applies_to_roof_system: string | null;
  line_item_id: string | null;
  item_name: string | null;
  unit: string | null;
  qty_mode: string;
  qty_factor: number;
  condition: string | null;
  code_reference: string;
  note: string | null;
}

export interface CodeRuleResolution {
  set: CodeRuleSet | null;
  items: CodeRuleItem[];
}

/** Counties that fall inside Florida's high velocity hurricane zone. */
export const FL_HVHZ_COUNTIES = ["miami-dade", "broward"];

export async function resolveCodeRules(args: {
  state: string | null;
  county: string | null;
}): Promise<CodeRuleResolution> {
  const state = (args.state ?? "").trim().toUpperCase();
  if (!state) return { set: null, items: [] };
  const county = (args.county ?? "").trim().toLowerCase().replace(/\s+county$/, "");

  const { data } = await supabase
    .from("code_rule_sets")
    .select("id, state, county, name, effective_date, notes")
    .eq("state", state);

  const sets = (data ?? []) as CodeRuleSet[];
  if (!sets.length) return { set: null, items: [] };

  const countyMatch = county
    ? sets.find((s) => (s.county ?? "").trim().toLowerCase() === county)
    : null;
  const set = countyMatch ?? sets.find((s) => !s.county) ?? null;
  if (!set) return { set: null, items: [] };

  const { data: items } = await supabase
    .from("code_rule_items")
    .select(
      "id, rule_set_id, applies_to_roof_system, line_item_id, item_name, unit, qty_mode, qty_factor, condition, code_reference, note",
    )
    .eq("rule_set_id", set.id)
    .order("sort_order", { ascending: true });

  return { set, items: (items ?? []) as CodeRuleItem[] };
}
