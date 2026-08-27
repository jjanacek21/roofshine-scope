import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Seed a company's SPF calculator from the platform template.
 *
 * A brand new company gets an empty calculator, which is correct — nobody
 * should inherit another company's pricing — but it also means starting from a
 * blank sheet and rebuilding a catalog that is mostly identical everywhere.
 * The products, the detail line items, the coating stacks and the field
 * structure are the same trade knowledge for every SPF contractor; only the
 * money differs.
 *
 * So this copies the whole structure across and zeroes every dollar figure.
 * The company gets a calculator that already knows how to estimate and simply
 * has no prices in it yet, which is a much shorter walk than an empty screen.
 */

/**
 * Field-default keys that hold money.
 *
 * Deliberately excludes the production rates (`l_foamrate`, `l_preprate`,
 * `l_rustrate`, `l_tearrate`, `r_rate`) — those read as "rate" but are sq ft
 * per day, and the engine divides by them. Zeroing those would not clear a
 * price, it would blow up the schedule. Counts (`q_dump`, `s_insp`,
 * `l_crew`, `l_mobs`) are left alone for the same reason: the money sits in
 * their paired `*c` field.
 */
const MONEY_FIELD_KEYS = new Set([
  // Existing roof
  "e_tearcost",
  "e_deckrepc",
  // Access
  "a_liftrate",
  "a_liftdel",
  "a_cranerate",
  "a_hoist",
  // Foam
  "f_cost",
  "f_freight",
  // Reinforcement
  "r_c",
  "r_fieldc",
  // Labor
  "l_wage",
  "l_mobc",
  "l_diem",
  "l_lodge",
  "l_super",
  // Equipment
  "q_rig",
  "q_fuel",
  "q_pump",
  "q_wash",
  "q_cons",
  "q_hand",
  "q_dumpc",
  "q_trailer",
  "q_veh",
  // Soft costs
  "s_engov",
  "s_pflat",
  "s_plan",
  "s_inspc",
  "s_noa",
  "s_ir",
  "s_core",
  "s_mock",
  "s_3rd",
  "s_warfee",
  // Markups — percentages, but they are this company's pricing policy and
  // nobody should inherit someone else's margin, tax rate or overhead.
  "m_tax",
  "m_cont",
  "m_gl",
  "m_bond",
  "m_oh",
  "m_comm",
  "m_margin",
  "m_fin",
]);

export type SpfTemplateInfo = {
  available: boolean;
  products: number;
  details: number;
  stacks: number;
  fields: number;
};

/**
 * The template company is whichever company the platform's super admin belongs
 * to — the account that has been building this catalog all along. Resolved at
 * call time rather than hardcoded so it survives the platform company being
 * renamed or recreated.
 */
async function templateCompanyId(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("company_id")
    .eq("role", "super_admin")
    .not("company_id", "is", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.company_id ?? null;
}

/** What the template holds, so the caller can say what will be copied. */
export const spfTemplateInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SpfTemplateInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tpl = await templateCompanyId(supabaseAdmin);
    if (!tpl) return { available: false, products: 0, details: 0, stacks: 0, fields: 0 };

    const count = async (
      table: "spf_products" | "spf_details" | "spf_stacks" | "spf_field_defaults",
    ) => {
      const { count: n } = await supabaseAdmin
        .from(table)
        .select("company_id", { count: "exact", head: true })
        .eq("company_id", tpl);
      return n ?? 0;
    };

    const [products, details, stacks, fields] = await Promise.all([
      count("spf_products"),
      count("spf_details"),
      count("spf_stacks"),
      count("spf_field_defaults"),
    ]);

    return { available: products > 0, products, details, stacks, fields };
  });

export type SeedResult = {
  products: number;
  details: number;
  stacks: number;
  layers: number;
  fields: number;
};

export const seedSpfFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeedResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("company_id, role")
      .eq("id", context.userId)
      .maybeSingle();

    if (!me?.company_id) throw new Error("You are not attached to a company yet.");
    if (!["owner", "admin", "super_admin"].includes(me.role as string)) {
      throw new Error("Only an owner or admin can set up the calculator.");
    }

    const target = me.company_id;
    const tpl = await templateCompanyId(supabaseAdmin);
    if (!tpl) throw new Error("No template catalog is available yet.");
    if (tpl === target) throw new Error("This company is the template — there is nothing to copy.");

    // Refuse to double up. Clearing first would throw away work someone
    // already did, so an existing catalog is left exactly as it is.
    const { count: existing } = await supabaseAdmin
      .from("spf_products")
      .select("id", { count: "exact", head: true })
      .eq("company_id", target);
    if ((existing ?? 0) > 0) {
      throw new Error("This company already has calculator products — clear them first.");
    }

    /* ---- Products: same catalog, no prices ---- */
    const { data: tplProducts } = await supabaseAdmin
      .from("spf_products")
      .select("id, name, solids_pct, default_mils, default_method, role, sort_order, active")
      .eq("company_id", tpl)
      .order("sort_order");

    const productIdMap = new Map<string, string>();
    if (tplProducts?.length) {
      const { data: made, error } = await supabaseAdmin
        .from("spf_products")
        .insert(
          tplProducts.map((p) => ({
            company_id: target,
            name: p.name,
            solids_pct: p.solids_pct,
            cost_per_gal: 0,
            default_mils: p.default_mils,
            default_method: p.default_method,
            role: p.role,
            sort_order: p.sort_order,
            active: p.active,
          })) as never,
        )
        .select("id, name, sort_order");
      if (error) throw new Error(error.message);
      // Match on name + position; both are copied verbatim so the pairing holds.
      for (const src of tplProducts) {
        const hit = (made ?? []).find(
          (m) => m.name === src.name && m.sort_order === src.sort_order,
        );
        if (hit) productIdMap.set(src.id, hit.id);
      }
    }

    /* ---- Detail line items: same list, unit costs zeroed ---- */
    const { data: tplDetails } = await supabaseAdmin
      .from("spf_details")
      .select("label, unit, default_qty, sort_order, active")
      .eq("company_id", tpl)
      .order("sort_order");

    if (tplDetails?.length) {
      const { error } = await supabaseAdmin.from("spf_details").insert(
        tplDetails.map((d) => ({
          company_id: target,
          label: d.label,
          unit: d.unit,
          default_qty: d.default_qty,
          unit_cost: 0,
          sort_order: d.sort_order,
          active: d.active,
        })) as never,
      );
      if (error) throw new Error(error.message);
    }

    /* ---- Stacks and their layers: pure recipe, copied intact ---- */
    const { data: tplStacks } = await supabaseAdmin
      .from("spf_stacks")
      .select("id, key, label, sort_order, active")
      .eq("company_id", tpl)
      .order("sort_order");

    let layerCount = 0;
    if (tplStacks?.length) {
      const { data: madeStacks, error } = await supabaseAdmin
        .from("spf_stacks")
        .insert(
          tplStacks.map((s) => ({
            company_id: target,
            key: s.key,
            label: s.label,
            sort_order: s.sort_order,
            active: s.active,
          })) as never,
        )
        .select("id, key");
      if (error) throw new Error(error.message);

      const stackIdMap = new Map<string, string>();
      for (const src of tplStacks) {
        const hit = (madeStacks ?? []).find((m) => m.key === src.key);
        if (hit) stackIdMap.set(src.id, hit.id);
      }

      const { data: tplLayers } = await supabaseAdmin
        .from("spf_stack_layers")
        .select("stack_id, product_id, scope, amount, method, mils, sort_order, on_by_default")
        .eq("company_id", tpl)
        .order("sort_order");

      const layers = (tplLayers ?? [])
        .map((l) => {
          const stack_id = stackIdMap.get(l.stack_id);
          const product_id = productIdMap.get(l.product_id);
          // A layer whose product or stack did not come across would be a
          // dangling row, so it is dropped rather than inserted broken.
          if (!stack_id || !product_id) return null;
          return {
            company_id: target,
            stack_id,
            product_id,
            scope: l.scope,
            amount: l.amount,
            method: l.method,
            mils: l.mils,
            sort_order: l.sort_order,
            on_by_default: l.on_by_default,
          };
        })
        .filter(Boolean);

      if (layers.length) {
        const { error: layerErr } = await supabaseAdmin
          .from("spf_stack_layers")
          .insert(layers as never);
        if (layerErr) throw new Error(layerErr.message);
        layerCount = layers.length;
      }
    }

    /* ---- Field defaults: structure kept, money zeroed ---- */
    const { data: tplFields } = await supabaseAdmin
      .from("spf_field_defaults")
      .select("field_key, label, group_key, value_text, simple_mode, sort_order")
      .eq("company_id", tpl)
      .order("sort_order");

    if (tplFields?.length) {
      const { error } = await supabaseAdmin.from("spf_field_defaults").insert(
        tplFields.map((f) => ({
          company_id: target,
          field_key: f.field_key,
          label: f.label,
          group_key: f.group_key,
          value_text: MONEY_FIELD_KEYS.has(f.field_key) ? "0" : f.value_text,
          simple_mode: f.simple_mode,
          sort_order: f.sort_order,
        })) as never,
      );
      if (error) throw new Error(error.message);
    }

    return {
      products: tplProducts?.length ?? 0,
      details: tplDetails?.length ?? 0,
      stacks: tplStacks?.length ?? 0,
      layers: layerCount,
      fields: tplFields?.length ?? 0,
    };
  });
