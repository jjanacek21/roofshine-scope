import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* types shared with the UI                                            */
/* ------------------------------------------------------------------ */

export interface CbSiteAiChange {
  table: string;
  row_key: string;
  path: string;
  old: string;
  new: string;
  why: string;
  /** filled server-side: human label of the row */
  label?: string;
  /** true when this creates a new FAQ entry */
  insert?: boolean;
}

export interface CbSiteAiProposal {
  answer: string;
  changes: CbSiteAiChange[];
  questions: string[];
  dropped: string[];
  raw: string;
}

export interface CbSiteEditRow {
  id: string;
  table_name: string;
  row_key: string;
  path: string | null;
  old_value: string | null;
  new_value: string | null;
  instruction: string | null;
  applied_at: string;
  reverted_at: string | null;
}

/* ------------------------------------------------------------------ */
/* guards                                                              */
/* ------------------------------------------------------------------ */

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if ((data as { role?: string } | null)?.role !== "super_admin") {
    throw new Error("Super admins only.");
  }
}

function requireKey(): string {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it in secrets — the AI editor will not use another provider.",
    );
  }
  return key;
}

/* ------------------------------------------------------------------ */
/* snapshot of the four content tables                                 */
/* ------------------------------------------------------------------ */

async function snapshot() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [blocks, faq, videos, media] = await Promise.all([
    supabaseAdmin
      .from("cb_site_blocks")
      .select("key, label, content, sort_order, is_published")
      .order("sort_order"),
    supabaseAdmin
      .from("cb_site_faq")
      .select("id, question, answer, category, sort_order, is_published")
      .order("sort_order"),
    supabaseAdmin
      .from("cb_site_videos")
      .select("id, title, description, video_url, section, sort_order, is_published")
      .order("sort_order"),
    // titles/captions only — never the images
    supabaseAdmin
      .from("cb_site_media")
      .select("id, media_key, title, caption, category, sort_order")
      .order("sort_order"),
  ]);
  return {
    cb_site_blocks: blocks.data ?? [],
    cb_site_faq: faq.data ?? [],
    cb_site_videos: videos.data ?? [],
    cb_site_media: media.data ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* propose                                                             */
/* ------------------------------------------------------------------ */

export const cbSiteAiPropose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ instruction: z.string().min(2).max(4000) }).parse(d))
  .handler(async ({ data, context }): Promise<CbSiteAiProposal> => {
    await assertSuperAdmin(context.userId);
    const key = requireKey();
    const { askModel } = await import("./cb-site-ai.server");
    const { sanitizeChanges } = await import("./cb-site-ai-guard.server");

    const rows = await snapshot();
    const userContent = [
      "CURRENT CONTENT (JSON):",
      JSON.stringify(rows),
      "",
      "USER MESSAGE:",
      data.instruction,
    ].join("\n");

    const { raw, parsed } = await askModel(key, userContent);
    const { changes, dropped } = sanitizeChanges(parsed.changes ?? [], rows);

    return {
      answer: typeof parsed.answer === "string" ? parsed.answer : "",
      changes,
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.filter((q): q is string => typeof q === "string")
        : [],
      dropped,
      raw,
    };
  });

/* ------------------------------------------------------------------ */
/* apply                                                               */
/* ------------------------------------------------------------------ */

const ChangeSchema = z.object({
  table: z.string(),
  row_key: z.string(),
  path: z.string(),
  old: z.string(),
  new: z.string(),
  why: z.string().optional().default(""),
});

export const cbSiteAiApply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ instruction: z.string().max(4000), changes: z.array(ChangeSchema).min(1) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ applied: number; errors: string[] }> => {
    await assertSuperAdmin(context.userId);
    const { applyChanges } = await import("./cb-site-ai-guard.server");
    const rows = await snapshot();
    return applyChanges(data.changes as CbSiteAiChange[], rows, data.instruction, context.userId);
  });

/* ------------------------------------------------------------------ */
/* history + revert                                                    */
/* ------------------------------------------------------------------ */

export const cbSiteAiHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CbSiteEditRow[]> => {
    await assertSuperAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cb_site_edits")
      .select("id, table_name, row_key, path, old_value, new_value, instruction, applied_at, reverted_at")
      .order("applied_at", { ascending: false })
      .limit(50);
    return (data ?? []) as unknown as CbSiteEditRow[];
  });

export const cbSiteAiRevert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertSuperAdmin(context.userId);
    const { revertEdit } = await import("./cb-site-ai-guard.server");
    await revertEdit(data.id);
    return { ok: true };
  });
