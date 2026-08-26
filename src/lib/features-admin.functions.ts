import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertSuperAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (data?.role !== "super_admin") throw new Error("Forbidden: super admin only");
}

/** Companies + the feature registry, for the super-admin entitlements screen. */
export const loadFeatureAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);

    const [companies, features, presets, presetItems] = await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      supabase
        .from("platform_features")
        .select("key, parent_key, label, description, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order"),
      supabase.from("feature_presets").select("id, name, description").order("name"),
      supabase.from("feature_preset_items").select("preset_id, feature_key"),
    ]);

    return {
      companies: companies.data ?? [],
      features: features.data ?? [],
      presets: (presets.data ?? []).map((p) => ({
        ...p,
        keys: (presetItems.data ?? [])
          .filter((i) => i.preset_id === p.id)
          .map((i) => i.feature_key),
      })),
    };
  });

/** Grants for one company. */
export const loadCompanyGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { data: rows, error } = await supabase
      .from("company_features")
      .select("feature_key, enabled")
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Toggle a single feature for a company. Child rows are never touched. */
export const setCompanyFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        companyId: z.string().uuid(),
        featureKey: z.string().min(1),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { error } = await supabase.from("company_features").upsert(
      {
        company_id: data.companyId,
        feature_key: data.featureKey,
        enabled: data.enabled,
        granted_by: userId,
        granted_at: new Date().toISOString(),
      },
      { onConflict: "company_id,feature_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Apply a preset bundle: every key in the preset is enabled in one action. */
export const applyFeaturePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ companyId: z.string().uuid(), presetId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);

    const { data: items, error: iErr } = await supabase
      .from("feature_preset_items")
      .select("feature_key")
      .eq("preset_id", data.presetId);
    if (iErr) throw new Error(iErr.message);
    if (!items?.length) return { ok: true, applied: 0 };

    const now = new Date().toISOString();
    const { error } = await supabase.from("company_features").upsert(
      items.map((i) => ({
        company_id: data.companyId,
        feature_key: i.feature_key,
        enabled: true,
        granted_by: userId,
        granted_at: now,
      })),
      { onConflict: "company_id,feature_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, applied: items.length };
  });
