import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Company invite acceptance, done in one server-side step.
 *
 * The old path was invite → /signup → Supabase confirmation email → /onboarding
 * → accept. Four hops, and the third one is a wall: `supabase.auth.signUp()`
 * leaves the user unconfirmed, an unconfirmed user cannot sign in, and
 * `accept_company_invite` needs a signed-in user. So an invitee who missed or
 * lost the confirmation email was stuck with an account they could not use and
 * an invite stuck on "pending" — with "Email not confirmed" as the only clue.
 *
 * Receiving the invite at that address is already proof the address is theirs,
 * which is why this creates the account with `email_confirm: true` and consumes
 * the invite in the same call. Claim Buddy's invite flow has always worked this
 * way; this brings the main app in line with it.
 */

const LookupInput = z.object({ token: z.string().trim().min(1).max(255) });

const AcceptInput = z.object({
  token: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(200).optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
});

export type CompanyInviteLookup =
  | {
      ok: true;
      email: string;
      role: string;
      company: string;
      /** True when an auth user already exists for this address. */
      hasAccount: boolean;
    }
  | { ok: false; reason: "missing" | "accepted" | "expired" };

/** Read an invite by token without needing anyone to be signed in. */
export const lookupCompanyInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => LookupInput.parse(data))
  .handler(async ({ data }): Promise<CompanyInviteLookup> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("company_invites")
      .select("id, email, role, company_id, accepted_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false, reason: "missing" };
    if (invite.accepted_at) return { ok: false, reason: "accepted" };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { ok: false, reason: "expired" };
    }

    const email = invite.email.toLowerCase();

    const [{ data: company }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("companies").select("name").eq("id", invite.company_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle(),
    ]);

    return {
      ok: true,
      email,
      role: invite.role as string,
      company: company?.name ?? "your team",
      hasAccount: !!profile,
    };
  });

export type AcceptCompanyInviteResult = {
  email: string;
  role: string;
  company: string;
  /** True when a password was set, so the caller can sign in immediately. */
  canSignIn: boolean;
};

/**
 * Create or confirm the invitee's account and attach them to the company.
 *
 * Idempotent enough to be safe on a retry: an existing account is confirmed and
 * has its password reset rather than erroring, which is what rescues anyone
 * already stranded with an unconfirmed signup from the old flow.
 */
export const acceptCompanyInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => AcceptInput.parse(data))
  .handler(async ({ data }): Promise<AcceptCompanyInviteResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite } = await supabaseAdmin
      .from("company_invites")
      .select("id, email, role, company_id, accepted_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) throw new Error("We couldn't find that invite.");
    if (invite.accepted_at) throw new Error("This invite was already used.");
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new Error("This invite has expired — ask your admin to send a new one.");
    }

    const email = invite.email.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();

    let userId = existing?.id ?? null;

    if (!userId) {
      if (!data.password) throw new Error("Choose a password to finish setting up your account.");
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { first_name: data.firstName ?? null, last_name: data.lastName ?? null },
      });
      if (createErr || !created?.user) {
        throw new Error(createErr?.message ?? "Could not create the account");
      }
      userId = created.user.id;
    } else if (data.password) {
      // Confirms the address too — this is what unsticks an account created by
      // the old signup path and left unconfirmed.
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email_confirm: true,
      });
      if (updErr) throw new Error(updErr.message);
    }

    // A super_admin keeps their platform role; everyone else takes the invited one.
    const nextRole = existing?.role === "super_admin" ? existing.role : invite.role;

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        email,
        company_id: invite.company_id,
        role: nextRole,
        ...(data.firstName ? { first_name: data.firstName } : {}),
        ...(data.lastName ? { last_name: data.lastName } : {}),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "id" },
    );
    if (profileErr) throw new Error(profileErr.message);

    await supabaseAdmin
      .from("company_invites")
      .update({ accepted_at: new Date().toISOString() } as never)
      .eq("id", invite.id);

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", invite.company_id)
      .maybeSingle();

    return {
      email,
      role: invite.role as string,
      company: company?.name ?? "your team",
      canSignIn: !!data.password,
    };
  });

/**
 * Confirm an address that already has an account, when the person can prove a
 * pending invite was sent to it. No password change — this is purely the
 * "I clicked signup before accepting my invite" rescue.
 */
export const confirmInvitedEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string().trim().email() }).parse(data))
  .handler(async ({ data }): Promise<{ confirmed: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: invite } = await supabaseAdmin
      .from("company_invites")
      .select("id, expires_at")
      .eq("email", email)
      .is("accepted_at", null)
      .maybeSingle();
    if (!invite) return { confirmed: false };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { confirmed: false };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!profile) return { confirmed: false };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { confirmed: true };
  });
