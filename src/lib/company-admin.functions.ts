import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertSuperAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "super_admin") throw new Error("Forbidden: super admin only");
}

export type AdminCompanyRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  status: string;
  created_at: string;
  modules: string[];
  member_count: number;
  cb_tier: string | null;
  cb_status: string | null;
  cb_workspace_id: string | null;
};

/** Every company on the platform with module badges, CB tier and member counts. */
export const adminListCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCompanyRow[]> => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: companies }, { data: grants }, { data: profiles }, { data: workspaces }] =
      await Promise.all([
        supabaseAdmin
          .from("companies")
          .select("id, name, email, phone, logo_url, status, created_at")
          .order("name"),
        supabaseAdmin.from("company_features").select("company_id, feature_key, enabled"),
        supabaseAdmin.from("profiles").select("id, company_id"),
        supabaseAdmin.from("cb_workspaces").select("id, gc_company_id, tier, status"),
      ]);

    return (companies ?? []).map((c) => {
      const ws = (workspaces ?? []).find((w) => w.gc_company_id === c.id) ?? null;
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        logo_url: c.logo_url,
        status: (c as { status?: string }).status ?? "active",
        created_at: c.created_at,
        modules: (grants ?? [])
          .filter((g) => g.company_id === c.id && g.enabled && !g.feature_key.includes("."))
          .map((g) => g.feature_key)
          .sort(),
        member_count: (profiles ?? []).filter((p) => p.company_id === c.id).length,
        cb_tier: (ws as { tier?: string } | null)?.tier ?? null,
        cb_status: (ws as { status?: string } | null)?.status ?? null,
        cb_workspace_id: ws?.id ?? null,
      };
    });
  });

const DetailsSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(40).nullable().optional(),
  postal_code: z.string().trim().max(20).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(255).nullable().optional(),
  website: z.string().trim().max(255).nullable().optional(),
  license_numbers: z.array(z.string().trim().min(1)).optional(),
  trades: z.array(z.string().trim().min(1)).optional(),
  logo_url: z.string().trim().max(1000).nullable().optional(),
  primary_color: z.string().trim().max(32).nullable().optional(),
  accent_color: z.string().trim().max(32).nullable().optional(),
  module_label: z.string().trim().max(80).nullable().optional(),
});

/** Create or update a company's core details + branding. */
export const adminSaveCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DetailsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { id, ...values } = data;
    if (id) {
      const { error } = await supabaseAdmin
        .from("companies")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("companies")
      .insert(values)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/** Apply a preset's keys to a company (used at creation time). */
export const adminApplyPresetKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ companyId: z.string().uuid(), keys: z.array(z.string().min(1)) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.keys.length) return { ok: true, applied: 0 };
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("company_features").upsert(
      data.keys.map((k) => ({
        company_id: data.companyId,
        feature_key: k,
        enabled: true,
        granted_by: userId,
        granted_at: now,
      })),
      { onConflict: "company_id,feature_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, applied: data.keys.length };
  });

/** Archive (soft delete) or restore a company. */
export const adminSetCompanyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ companyId: z.string().uuid(), status: z.enum(["active", "archived"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { error } = await supabase.rpc("company_set_status", {
      _company_id: data.companyId,
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Blast radius for a permanent delete. */
export const adminCompanyDeleteCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { data: counts, error } = await supabase.rpc("company_delete_counts", {
      _company_id: data.companyId,
    });
    if (error) throw new Error(error.message);
    return (counts ?? {}) as Record<string, number>;
  });

/** Permanent, irreversible delete. Archived companies only, name must match. */
export const adminPurgeCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ companyId: z.string().uuid(), confirmName: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { data: deleted, error } = await supabase.rpc("company_purge", {
      _company_id: data.companyId,
      _confirm_name: data.confirmName,
    });
    if (error) throw new Error(error.message);
    return (deleted ?? {}) as Record<string, number>;
  });

/* ----------------------- Claim Buddy workspace link ---------------------- */

export const adminListCbWorkspaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cb_workspaces")
      .select("id, name, gc_company_id, tier, status")
      .order("name");
    return data ?? [];
  });

export const adminLinkCbWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        companyId: z.string().uuid(),
        workspaceId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only one workspace per company: clear any existing link first.
    await supabaseAdmin
      .from("cb_workspaces")
      .update({ gc_company_id: null })
      .eq("gc_company_id", data.companyId);

    if (data.workspaceId) {
      const { error } = await supabaseAdmin
        .from("cb_workspaces")
        .update({ gc_company_id: data.companyId })
        .eq("id", data.workspaceId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminCreateCbWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        companyId: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        tier: z.enum(["basic", "pro", "elite"]).default("basic"),
        seats: z.number().int().min(1).max(1000).default(3),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase as unknown as SupabaseClient, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ws, error } = await supabaseAdmin
      .from("cb_workspaces")
      .insert({
        name: data.name,
        origin: "platform",
        plan: "pro",
        tier: data.tier,
        status: "active",
        seats_purchased: data.seats,
        gc_company_id: data.companyId,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { workspaceId: ws.id as string };
  });
