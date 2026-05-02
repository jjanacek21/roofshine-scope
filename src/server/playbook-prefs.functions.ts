import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SetSchema = z.object({
  selected_sections: z.array(z.string()).max(50),
});

export const getMyPlaybook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("playbook_preferences")
      .select("selected_sections")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return { selected_sections: data?.selected_sections ?? null };
  });

export const setMyPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SetSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("playbook_preferences")
      .upsert(
        { user_id: userId, selected_sections: data.selected_sections },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return { ok: true };
  });
