import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Role = z.enum(["owner", "admin", "rep"]);

async function assertSuperAdmin(supabase: {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: { role?: string } | null }> };
    };
  };
}, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "super_admin") throw new Error("Super admins only.");
}

export interface CbAdminCompanyRow {
  workspace_id: string;
  name: string;
  origin: string;
  plan: string;
  tier: string;
  status: string;
  is_comp: boolean;
  features: Record<string, boolean>;
  seats_purchased: number;
  seats_used: number;
  seats_pending: number;
  job_count: number;
  created_at: string;
  members: {
    user_id: string;
    email: string | null;
    name: string | null;
    role: string;
    is_active: boolean;
    last_active_at: string | null;
    job_count: number;
  }[];
  invites: { id: string; email: string; role: string; created_at: string; token: string | null }[];
}

export const cbAdminListCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CbAdminCompanyRow[]> => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: workspaces }, { data: members }, { data: invites }, { data: jobs }, { data: profiles }] =
      await Promise.all([
        supabaseAdmin
          .from("cb_workspaces")
          .select("id, name, origin, plan, tier, status, is_comp, features, seats_purchased, created_at")
          .order("created_at", { ascending: true }),
        supabaseAdmin
          .from("cb_workspace_members")
          .select("workspace_id, user_id, role, is_active, last_active_at"),
        supabaseAdmin
          .from("cb_invites")
          .select("id, workspace_id, email, role, created_at, token")
          .is("accepted_at", null)
          .is("revoked_at", null),
        supabaseAdmin.from("cb_jobs").select("id, workspace_id, created_by"),
        supabaseAdmin.from("profiles").select("id, email, first_name, last_name"),
      ]);

    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (workspaces ?? []).map((w) => {
      const ms = (members ?? []).filter((m) => m.workspace_id === w.id);
      const js = (jobs ?? []).filter((j) => j.workspace_id === w.id);
      const is = (invites ?? []).filter((i) => i.workspace_id === w.id);
      return {
        workspace_id: w.id,
        name: w.name,
        origin: w.origin,
        plan: w.plan,
        tier: (w as { tier?: string }).tier ?? "basic",
        status: (w as { status?: string }).status ?? "active",
        is_comp: (w as { is_comp?: boolean }).is_comp ?? false,
        features: ((w as { features?: Record<string, boolean> }).features ?? {}) as Record<string, boolean>,
        seats_purchased: w.seats_purchased ?? 0,
        seats_used: ms.filter((m) => m.is_active).length,
        seats_pending: is.length,
        job_count: js.length,
        created_at: w.created_at,
        members: ms.map((m) => {
          const p = pmap.get(m.user_id);
          const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
          return {
            user_id: m.user_id,
            email: p?.email ?? null,
            name: name || null,
            role: m.role,
            is_active: m.is_active,
            last_active_at: m.last_active_at,
            job_count: js.filter((j) => j.created_by === m.user_id).length,
          };
        }),
        invites: is.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          created_at: i.created_at,
          token: i.token ?? null,
        })),
      };
    });
  });

const CreateCompanySchema = z.object({
  name: z.string().trim().min(1).max(160),
  seats: z.number().int().min(1).max(1000).default(3),
  plan: z.enum(["free", "pro", "team"]).default("pro"),
  ownerEmail: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(255).optional(),
  website: z.string().trim().max(255).optional(),
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(40).optional(),
  zip: z.string().trim().max(20).optional(),
});

export const cbAdminCreateCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateCompanySchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendMail, shell, CB_APP_URL } = await import("@/lib/cb-mail.server");

    const { data: ws, error } = await supabaseAdmin
      .from("cb_workspaces")
      .insert({
        name: data.name,
        origin: "standalone",
        plan: data.plan,
        seats_purchased: data.seats,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error || !ws) throw new Error(error?.message ?? "Could not create the company");

    await supabaseAdmin.from("cb_companies").insert({
      workspace_id: ws.id,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      zip: data.zip ?? null,
    } as never);

    let inviteLink: string | null = null;
    if (data.ownerEmail) {
      const email = data.ownerEmail.toLowerCase();
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing?.id) {
        await supabaseAdmin
          .from("cb_workspace_members")
          .upsert(
            { workspace_id: ws.id, user_id: existing.id, role: "owner", is_active: true } as never,
            { onConflict: "workspace_id,user_id" },
          );
        await sendMail({
          to: email,
          subject: `You're the owner of ${data.name} on Claim Buddy`,
          html: shell(
            `${data.name} is ready`,
            `<p>Your Claim Buddy account now owns <strong>${data.name}</strong>. Sign in to invite your team.</p>`,
            { label: "Open Claim Buddy", href: `${CB_APP_URL}/cb` },
          ),
        });
      } else {
        const { data: inv } = await supabaseAdmin
          .from("cb_invites")
          .insert({ workspace_id: ws.id, email, role: "owner", invited_by: context.userId } as never)
          .select("token")
          .single();
        inviteLink = `${CB_APP_URL}/cb/accept?token=${inv?.token ?? ""}`;
        await sendMail({
          to: email,
          subject: `You're invited to run ${data.name} on Claim Buddy`,
          html: shell(
            `Set up ${data.name} on Claim Buddy`,
            `<p>You've been set up as the <strong>owner</strong>. Accept the invite to choose a password and invite your reps.</p>`,
            { label: "Accept invite", href: inviteLink },
          ),
        });
      }
    }

    return { ok: true as const, workspaceId: ws.id, inviteLink };
  });

const CreateUserSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  role: Role,
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  password: z.string().min(8).max(72).optional(),
});

/** Creates or seats a user in a Claim Buddy company and emails them. */
export const cbAdminUpsertUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendMail, shell, CB_APP_URL } = await import("@/lib/cb-mail.server");

    const email = data.email.toLowerCase();
    const { data: ws } = await supabaseAdmin
      .from("cb_workspaces")
      .select("name")
      .eq("id", data.workspaceId)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId = profile?.id ?? null;

    if (!userId && data.password) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { first_name: data.firstName ?? null, last_name: data.lastName ?? null },
      });
      if (error || !created?.user) throw new Error(error?.message ?? "Could not create the user");
      userId = created.user.id;
      await supabaseAdmin.from("profiles").upsert(
        {
          id: userId,
          email,
          first_name: data.firstName ?? null,
          last_name: data.lastName ?? null,
          onboarding_completed_at: new Date().toISOString(),
        } as never,
        { onConflict: "id" },
      );
    }

    if (userId) {
      await supabaseAdmin
        .from("cb_workspace_members")
        .upsert(
          { workspace_id: data.workspaceId, user_id: userId, role: data.role, is_active: true } as never,
          { onConflict: "workspace_id,user_id" },
        );
      await sendMail({
        to: email,
        subject: `You've been added to ${ws?.name ?? "a Claim Buddy team"}`,
        html: shell(
          `You're on the ${ws?.name ?? "Claim Buddy"} team`,
          `<p>Your role is <strong>${data.role}</strong>.${data.password ? " Use the password you were given, then change it in settings." : ""}</p>`,
          { label: "Open Claim Buddy", href: `${CB_APP_URL}/cb` },
        ),
      });
      return { ok: true as const, seated: true as const };
    }

    const { data: inv, error: invErr } = await supabaseAdmin
      .from("cb_invites")
      .upsert(
        { workspace_id: data.workspaceId, email, role: data.role, invited_by: context.userId } as never,
        { onConflict: "workspace_id,email" },
      )
      .select("token")
      .single();
    if (invErr) throw new Error(invErr.message);

    const link = `${CB_APP_URL}/cb/accept?token=${inv?.token ?? ""}`;
    await sendMail({
      to: email,
      subject: `You're invited to ${ws?.name ?? "Claim Buddy"}`,
      html: shell(
        `Join ${ws?.name ?? "Claim Buddy"}`,
        `<p>You've been invited as <strong>${data.role}</strong>. Accept the invite to set your password.</p>`,
        { label: "Accept invite", href: link },
      ),
    });
    return { ok: true as const, seated: false as const, link };
  });

const SetRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: Role.optional(),
  isActive: z.boolean().optional(),
  remove: z.boolean().optional(),
});

export const cbAdminSetMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetRoleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.remove) {
      await supabaseAdmin
        .from("cb_workspace_members")
        .delete()
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", data.userId);
      return { ok: true as const };
    }

    const patch: Record<string, unknown> = {};
    if (data.role) patch.role = data.role;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (!Object.keys(patch).length) return { ok: true as const };

    const { error } = await supabaseAdmin
      .from("cb_workspace_members")
      .update(patch as never)
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const SetSeatsSchema = z.object({
  workspaceId: z.string().uuid(),
  seats: z.number().int().min(0).max(10000),
  plan: z.enum(["free", "pro", "team"]).optional(),
});

export const cbAdminSetSeats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetSeatsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cb_workspaces")
      .update({ seats_purchased: data.seats, ...(data.plan ? { plan: data.plan } : {}) } as never)
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


/* --------------------------- plan & access control -------------------------- */

const SetPlanSchema = z.object({
  workspaceId: z.string().uuid(),
  tier: z.enum(["basic", "pro", "elite"]).optional(),
  status: z.enum(["active", "suspended", "archived"]).optional(),
  isComp: z.boolean().optional(),
  /** Per-feature overrides. null clears an override back to the tier default. */
  features: z
    .record(
      z.enum(["ai_measure", "survival_guide", "price_book", "storm_intel"]),
      z.boolean().nullable(),
    )
    .optional(),
});

/** Sets the plan tier, account status, comp flag and per-feature overrides. */
export const cbAdminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SetPlanSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {};
    if (data.tier) patch.tier = data.tier;
    if (data.status) patch.status = data.status;
    if (data.isComp !== undefined) patch.is_comp = data.isComp;

    if (data.features) {
      const { data: current } = await supabaseAdmin
        .from("cb_workspaces")
        .select("features")
        .eq("id", data.workspaceId)
        .maybeSingle();
      const next = { ...(((current?.features ?? {}) as Record<string, boolean>) || {}) };
      for (const [key, value] of Object.entries(data.features)) {
        if (value === null) delete next[key];
        else next[key] = value;
      }
      patch.features = next;
    }

    if (!Object.keys(patch).length) return { ok: true as const };
    const { error } = await supabaseAdmin
      .from("cb_workspaces")
      .update(patch as never)
      .eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const DeleteCompanySchema = z.object({
  workspaceId: z.string().uuid(),
  /** Archive is reversible; purge removes the workspace and its data for good. */
  purge: z.boolean().default(false),
});

export const cbAdminDeleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteCompanySchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.purge) {
      const { error } = await supabaseAdmin
        .from("cb_workspaces")
        .update({ status: "archived" } as never)
        .eq("id", data.workspaceId);
      if (error) throw new Error(error.message);
      return { ok: true as const, purged: false };
    }

    await supabaseAdmin.from("cb_invites").delete().eq("workspace_id", data.workspaceId);
    await supabaseAdmin.from("cb_workspace_members").delete().eq("workspace_id", data.workspaceId);
    const { error } = await supabaseAdmin.from("cb_workspaces").delete().eq("id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const, purged: true };
  });

export interface CbAdminUserRow {
  user_id: string;
  email: string | null;
  name: string | null;
  memberships: {
    workspace_id: string;
    workspace_name: string;
    role: string;
    is_active: boolean;
    last_active_at: string | null;
  }[];
}

/** Every Claim Buddy user across all companies, for the Users tab. */
export const cbAdminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CbAdminUserRow[]> => {
    await assertSuperAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: members }, { data: workspaces }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("cb_workspace_members")
        .select("workspace_id, user_id, role, is_active, last_active_at"),
      supabaseAdmin.from("cb_workspaces").select("id, name"),
      supabaseAdmin.from("profiles").select("id, email, first_name, last_name"),
    ]);

    const wmap = new Map((workspaces ?? []).map((w) => [w.id, w.name]));
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const byUser = new Map<string, CbAdminUserRow>();

    for (const m of members ?? []) {
      let row = byUser.get(m.user_id);
      if (!row) {
        const p = pmap.get(m.user_id);
        const name = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
        row = { user_id: m.user_id, email: p?.email ?? null, name: name || null, memberships: [] };
        byUser.set(m.user_id, row);
      }
      row.memberships.push({
        workspace_id: m.workspace_id,
        workspace_name: wmap.get(m.workspace_id) ?? "—",
        role: m.role,
        is_active: m.is_active,
        last_active_at: m.last_active_at,
      });
    }

    return [...byUser.values()].sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  });
