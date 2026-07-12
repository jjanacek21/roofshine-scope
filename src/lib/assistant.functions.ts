import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deriveInputsFromMeasurement, mergeDerivedInputs } from "@/lib/order-form-derive";

// ---------- Threads ----------

export const listAssistantThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("assistant_threads")
      .select("id, title, updated_at, created_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title?: string }) => ({ title: input?.title ?? "New chat" }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("assistant_threads")
      .insert({ user_id: context.userId, title: data.title })
      .select("id, title, updated_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getAssistantThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { thread_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("assistant_messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.thread_id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { thread_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("assistant_threads")
      .delete()
      .eq("id", data.thread_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Order form auto-populate ----------

export const deriveOrderFormInputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { job_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: job } = await supabase
      .from("jobs")
      .select("id, property_id, company_id")
      .eq("id", data.job_id)
      .maybeSingle();
    if (!job) throw new Error("Job not found");
    if (!job.property_id) {
      return { ok: false, reason: "no_property", derived: {}, applied: [], skipped: [] };
    }
    const { data: meas } = await supabase
      .from("roof_measurements")
      .select("*")
      .eq("property_id", job.property_id)
      .maybeSingle();
    if (!meas) {
      return { ok: false, reason: "no_measurement", derived: {}, applied: [], skipped: [] };
    }

    const derived = deriveInputsFromMeasurement(meas);

    const { data: draft } = await supabase
      .from("job_order_drafts")
      .select("id, inputs, manual_input_keys")
      .eq("job_id", data.job_id)
      .maybeSingle();

    const existing = ((draft?.inputs ?? {}) as Record<string, number>) || {};
    const manualKeys = (draft?.manual_input_keys ?? []) as string[];
    const { next, applied, skipped } = mergeDerivedInputs(existing, derived, manualKeys);

    if (draft?.id) {
      const { error } = await supabase
        .from("job_order_drafts")
        .update({ inputs: next })
        .eq("id", draft.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("job_order_drafts").insert({
        job_id: data.job_id,
        company_id: job.company_id,
        inputs: next,
      });
      if (error) throw new Error(error.message);
    }

    return { ok: true, derived, applied, skipped, next };
  });
