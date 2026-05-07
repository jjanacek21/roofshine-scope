import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DeleteUserSchema = z.object({ userId: z.string().uuid() });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId: actorId } = context;

    if (data.userId === actorId) {
      throw new Error("You can't delete yourself.");
    }

    // Look up actor and target profiles using admin client (bypasses RLS).
    const { data: actor, error: actorErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, company_id")
      .eq("id", actorId)
      .maybeSingle();
    if (actorErr) throw new Error(actorErr.message);
    if (!actor) throw new Error("Actor profile not found");

    const { data: target, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, company_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target) throw new Error("User not found");

    const isSuper = actor.role === "super_admin";
    const isCompanyAdmin =
      (actor.role === "owner" || actor.role === "admin") &&
      actor.company_id != null &&
      actor.company_id === target.company_id;

    if (!isSuper && !isCompanyAdmin) {
      throw new Error("You don't have permission to delete this user.");
    }

    // Only super admins can delete other super admins.
    if (target.role === "super_admin" && !isSuper) {
      throw new Error("Only a super admin can delete a super admin.");
    }

    // Delete the auth user; profile is removed via FK cascade on auth.users.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message);

    // Best-effort: also delete the profile row in case no cascade is configured.
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    return { success: true };
  });

const UpdateUserSchema = z.object({
  userId: z.string().uuid(),
  first_name: z.string().trim().max(100).nullable().optional(),
  last_name: z.string().trim().max(100).nullable().optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(["super_admin", "owner", "admin", "estimator", "member"]).optional(),
  company_id: z.string().uuid().nullable().optional(),
});

export const updateUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId: actorId } = context;

    const { data: actor, error: actorErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, company_id")
      .eq("id", actorId)
      .maybeSingle();
    if (actorErr) throw new Error(actorErr.message);
    if (!actor) throw new Error("Actor profile not found");

    const { data: target, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, company_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target) throw new Error("User not found");

    const isSuper = actor.role === "super_admin";
    const isCompanyAdmin =
      (actor.role === "owner" || actor.role === "admin") &&
      actor.company_id != null &&
      actor.company_id === target.company_id;

    if (!isSuper && !isCompanyAdmin) {
      throw new Error("You don't have permission to edit this user.");
    }
    if (target.role === "super_admin" && !isSuper) {
      throw new Error("Only a super admin can edit a super admin.");
    }
    if (data.role === "super_admin" && !isSuper) {
      throw new Error("Only a super admin can grant super_admin.");
    }
    if (!isSuper && data.company_id !== undefined && data.company_id !== actor.company_id) {
      throw new Error("You can't move users to another company.");
    }

    // Update email via auth admin if changed
    if (data.email && data.email.toLowerCase() !== undefined) {
      const { error: emailErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: data.email.toLowerCase(),
        email_confirm: true,
      });
      if (emailErr) throw new Error(emailErr.message);
    }

    const profileUpdate: Record<string, string | null> = {};
    if (data.first_name !== undefined) profileUpdate.first_name = data.first_name || null;
    if (data.last_name !== undefined) profileUpdate.last_name = data.last_name || null;
    if (data.email !== undefined) profileUpdate.email = data.email.toLowerCase();
    if (data.role !== undefined) profileUpdate.role = data.role;
    if (data.company_id !== undefined) profileUpdate.company_id = data.company_id;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate as never)
        .eq("id", data.userId);
      if (updErr) throw new Error(updErr.message);
    }

    return { success: true };
  });
