import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Look up a profile by email (case-insensitive). Super-admin only.
 * Used by the Contracts admin page to link a rep to a real user account.
 */
export const lookupUserByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is super_admin
    const { data: me } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (me?.role !== "super_admin") {
      throw new Error("Forbidden: super admin only");
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .ilike("email", data.email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return profile;
  });
