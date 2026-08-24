import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Role = z.enum(["owner", "admin", "rep"]);

/* ------------------------------------------------------------------ */
/* Invitations                                                         */
/* ------------------------------------------------------------------ */

const InviteInput = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  role: Role,
});

export const cbSendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InviteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { sendMail, shell, CB_APP_URL } = await import("@/lib/cb-mail.server");

    const { data: result, error } = await context.supabase.rpc("cb_invite_member", {
      _ws: data.workspaceId,
      _email: data.email,
      _role: data.role,
    });
    if (error) throw new Error(error.message);

    const payload = (result ?? {}) as { seated?: boolean; token?: string };

    const { data: ws } = await context.supabase
      .from("cb_workspaces")
      .select("name")
      .eq("id", data.workspaceId)
      .maybeSingle();
    const company = ws?.name ?? "your team";

    if (payload.seated) {
      await sendMail({
        to: data.email,
        subject: `You've been added to ${company} on Claim Buddy`,
        html: shell(
          `You're on the ${company} team`,
          `<p>Your existing Claim Buddy account now has access to <strong>${company}</strong> as <strong>${data.role}</strong>. Sign in and it will be there.</p>`,
          { label: "Open Claim Buddy", href: `${CB_APP_URL}/cb` },
        ),
      });
      return { ok: true as const, seated: true as const };
    }

    const link = `${CB_APP_URL}/cb/accept?token=${payload.token ?? ""}`;
    const mail = await sendMail({
      to: data.email,
      subject: `You're invited to ${company} on Claim Buddy`,
      html: shell(
        `Join ${company} on Claim Buddy`,
        `<p>You've been invited as <strong>${data.role}</strong>. Accept the invite to set your password and start inspecting.</p>`,
        { label: "Accept invite", href: link },
      ),
    });

    return { ok: true as const, seated: false as const, emailed: mail.ok, link };
  });

const ResendInput = z.object({ inviteId: z.string().uuid() });

export const cbResendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ResendInput.parse(data))
  .handler(async ({ data, context }) => {
    const { sendMail, shell, CB_APP_URL } = await import("@/lib/cb-mail.server");

    /* RLS: only workspace admins can read invites. */
    const { data: invite, error } = await context.supabase
      .from("cb_invites")
      .select("email, role, token, workspace_id")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found");

    const { data: ws } = await context.supabase
      .from("cb_workspaces")
      .select("name")
      .eq("id", invite.workspace_id)
      .maybeSingle();

    const link = `${CB_APP_URL}/cb/accept?token=${invite.token ?? ""}`;
    const mail = await sendMail({
      to: invite.email,
      subject: `Reminder: join ${ws?.name ?? "your team"} on Claim Buddy`,
      html: shell(
        `Join ${ws?.name ?? "your team"} on Claim Buddy`,
        `<p>Your invite is still open. Accept it to set your password and get started.</p>`,
        { label: "Accept invite", href: link },
      ),
    });
    return { ok: mail.ok, link };
  });

const TokenInput = z.object({ token: z.string().min(10).max(200) });

export const cbLookupInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => TokenInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("cb_invites")
      .select("id, email, role, workspace_id, accepted_at, revoked_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false as const, reason: "not_found" as const };
    if (invite.revoked_at) return { ok: false as const, reason: "revoked" as const };
    if (invite.accepted_at) return { ok: false as const, reason: "accepted" as const };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }

    const { data: ws } = await supabaseAdmin
      .from("cb_workspaces")
      .select("name")
      .eq("id", invite.workspace_id)
      .maybeSingle();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", invite.email.toLowerCase())
      .maybeSingle();

    return {
      ok: true as const,
      email: invite.email,
      role: invite.role,
      company: ws?.name ?? "Claim Buddy",
      hasAccount: !!existing,
    };
  });

const AcceptInput = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(72).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
});

export const cbAcceptInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AcceptInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("cb_invites")
      .select("id, email, role, workspace_id, accepted_at, revoked_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite || invite.revoked_at || invite.accepted_at) throw new Error("This invite is no longer valid.");
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new Error("This invite has expired.");

    const email = invite.email.toLowerCase();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId = profile?.id ?? null;

    if (!userId) {
      if (!data.password) throw new Error("Choose a password to finish setting up your account.");
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { first_name: data.firstName ?? null, last_name: data.lastName ?? null },
      });
      if (createErr || !created?.user) throw new Error(createErr?.message ?? "Could not create the account");
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
    } else if (data.password) {
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: data.password, email_confirm: true });
    }

    await supabaseAdmin
      .from("cb_workspace_members")
      .upsert(
        { workspace_id: invite.workspace_id, user_id: userId, role: invite.role, is_active: true } as never,
        { onConflict: "workspace_id,user_id" },
      );

    await supabaseAdmin
      .from("cb_invites")
      .update({ accepted_at: new Date().toISOString() } as never)
      .eq("id", invite.id);

    return { ok: true as const, email };
  });

/* ------------------------------------------------------------------ */
/* Seats                                                               */
/* ------------------------------------------------------------------ */

const SeatsInput = z.object({
  workspaceId: z.string().uuid(),
  seats: z.number().int().min(1).max(500),
  note: z.string().trim().max(1000).optional(),
});

/** Owners ask for more seats; super admins are emailed and grant them in the portal. */
export const cbRequestSeats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SeatsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { sendMail, shell } = await import("@/lib/cb-mail.server");

    const { data: isOwner, error: roleErr } = await context.supabase.rpc("cb_is_owner", {
      _ws: data.workspaceId,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Only the owner can request more seats.");

    const { data: ws } = await context.supabase
      .from("cb_workspaces")
      .select("name, seats_purchased")
      .eq("id", data.workspaceId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("role", "super_admin");

    const to = (admins ?? []).map((a) => a.email).filter((e): e is string => !!e);
    if (to.length) {
      await sendMail({
        to,
        subject: `Seat request — ${ws?.name ?? "Claim Buddy workspace"} (+${data.seats})`,
        html: shell(
          "Seat request",
          `<p><strong>${ws?.name ?? "A workspace"}</strong> asked for <strong>${data.seats}</strong> more seats (currently ${ws?.seats_purchased ?? 0}).</p>
           ${data.note ? `<p>Note: ${data.note}</p>` : ""}
           <p>Workspace id: ${data.workspaceId}</p>`,
        ),
      });
    }

    await supabaseAdmin.from("cb_audit_log").insert({
      workspace_id: data.workspaceId,
      actor: context.userId,
      action: "seats.requested",
      entity: "cb_workspaces",
      entity_id: data.workspaceId,
      meta: { seats: data.seats, note: data.note ?? null },
    } as never);

    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Demo requests / signup confirmations (marketing site)               */
/* ------------------------------------------------------------------ */

const DemoInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  seats: z.number().int().min(1).max(1000).optional(),
  message: z.string().trim().max(2000).optional(),
  kind: z.enum(["demo", "signup"]).default("demo"),
});

export const cbSubmitDemoRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DemoInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendMail, shell, CB_APP_URL } = await import("@/lib/cb-mail.server");

    const { error } = await supabaseAdmin.from("cb_demo_requests").insert({
      name: data.name,
      email: data.email.toLowerCase(),
      company: data.company ?? null,
      phone: data.phone ?? null,
      seats: data.seats ?? null,
      message: data.message ?? null,
      kind: data.kind,
    } as never);
    if (error) throw new Error(error.message);

    await sendMail({
      to: data.email,
      subject: data.kind === "demo" ? "We got your demo request" : "Welcome to Claim Buddy",
      html: shell(
        data.kind === "demo" ? "Thanks — we'll be in touch" : "Welcome to Claim Buddy",
        data.kind === "demo"
          ? `<p>Hi ${data.name}, we received your demo request${data.company ? ` for ${data.company}` : ""}. Someone from the team will reach out shortly to schedule it.</p>`
          : `<p>Hi ${data.name}, thanks for signing up. Your account is being set up — you'll get an invite link next.</p>`,
        { label: "See Claim Buddy", href: CB_APP_URL },
      ),
    });

    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("role", "super_admin");
    const to = (admins ?? []).map((a) => a.email).filter((e): e is string => !!e);
    if (to.length) {
      await sendMail({
        to,
        subject: `New ${data.kind} request — ${data.company ?? data.name}`,
        html: shell(
          `New ${data.kind} request`,
          `<p>${data.name} · ${data.email}${data.phone ? ` · ${data.phone}` : ""}</p>
           ${data.company ? `<p>Company: ${data.company}</p>` : ""}
           ${data.seats ? `<p>Seats: ${data.seats}</p>` : ""}
           ${data.message ? `<p>${data.message}</p>` : ""}`,
        ),
      });
    }

    return { ok: true as const };
  });
