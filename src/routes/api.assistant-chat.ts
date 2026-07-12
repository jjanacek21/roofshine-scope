import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ASSISTANT_TOOLS, FEATURE_EXPLANATIONS, APP_ROUTES } from "@/lib/assistant-tools";
import { deriveInputsFromMeasurement, mergeDerivedInputs } from "@/lib/order-form-derive";

type ChatMessagePart =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: unknown };

type StoredMessage = {
  role: "user" | "assistant" | "system" | "tool";
  parts: ChatMessagePart[];
};

type IncomingBody = {
  thread_id: string;
  user_message: string;
  context?: { path?: string | null; job_id?: string | null; lead_id?: string | null };
};

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_STEPS = 8;

// -------- Feature explanations & tool executors --------

async function runTool(
  name: string,
  args: Record<string, unknown>,
  sb: SupabaseClient,
  userId: string,
  ctxHint?: IncomingBody["context"],
): Promise<{ result: unknown }> {
  switch (name) {
    case "navigate": {
      const path = String(args.path ?? "").trim();
      return { result: { action: "navigate", path } };
    }
    case "explain_feature": {
      const key = String(args.topic ?? "").toLowerCase().replace(/[-\s]/g, "_");
      const text = FEATURE_EXPLANATIONS[key] ?? `No help entry for '${args.topic}'.`;
      return { result: { text } };
    }
    case "get_current_context": {
      return { result: { path: ctxHint?.path ?? null, job_id: ctxHint?.job_id ?? null, lead_id: ctxHint?.lead_id ?? null } };
    }
    case "search_leads": {
      const q = String(args.query ?? "").trim();
      const { data } = await sb
        .from("leads")
        .select("id, address, city, owner, status")
        .or(`address.ilike.%${q}%,owner.ilike.%${q}%,city.ilike.%${q}%`)
        .limit(8);
      return { result: { leads: data ?? [] } };
    }
    case "search_jobs": {
      const q = String(args.query ?? "").trim();
      const { data } = await sb
        .from("jobs")
        .select("id, name, property_address, status, job_number")
        .or(`name.ilike.%${q}%,property_address.ilike.%${q}%,job_number.ilike.%${q}%`)
        .limit(8);
      return { result: { jobs: data ?? [] } };
    }
    case "create_lead": {
      const { data: profile } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
      if (!profile?.company_id) return { result: { error: "No company for user" } };
      const notes = String(args.notes ?? "");
      const insertRow: Record<string, unknown> = {
        company_id: profile.company_id,
        address: String(args.address ?? ""),
        city: args.city ?? null,
        state: args.state ?? "FL",
        zip: args.zip ?? null,
        owner: args.owner ?? null,
        roof_type: args.roof_type ?? "Unknown",
        property_type: args.property_type ?? "Residential",
        year_built: args.year_built ?? null,
        sqft: args.sqft ?? null,
        estimated_value: args.estimated_value ?? null,
        status: "new",
      };
      const { data: lead, error } = await sb.from("leads").insert(insertRow).select("id, address, owner").single();
      if (error) return { result: { error: error.message } };

      // optional contact
      if (args.owner || args.phone || args.email) {
        const { data: contact } = await sb
          .from("lead_contacts")
          .insert({ lead_id: lead.id, name: String(args.owner ?? "Primary"), sort_order: 0 })
          .select("id")
          .single();
        if (contact) {
          if (args.phone) await sb.from("lead_contact_phones").insert({ contact_id: contact.id, phone: String(args.phone) });
          if (args.email) await sb.from("lead_contact_emails").insert({ contact_id: contact.id, email: String(args.email) });
        }
      }
      if (notes || args.claim_number) {
        await sb.from("lead_notes").insert({
          lead_id: lead.id,
          body: [notes, args.claim_number ? `Claim #: ${args.claim_number}` : ""].filter(Boolean).join("\n"),
        });
      }
      return { result: { lead_id: lead.id, address: lead.address, owner: lead.owner, action: "created_lead" } };
    }
    case "create_job": {
      const { data: profile } = await sb.from("profiles").select("company_id").eq("id", userId).maybeSingle();
      if (!profile?.company_id) return { result: { error: "No company for user" } };
      const row: Record<string, unknown> = {
        company_id: profile.company_id,
        name: String(args.name ?? "New Job"),
        property_address: args.property_address ?? null,
        primary_trade: args.primary_trade ?? "Roofing",
        job_type: args.job_type ?? null,
        claim_number: args.claim_number ?? null,
        insurance_carrier: args.insurance_carrier ?? null,
        client_id: args.client_id ?? null,
        notes: args.notes ?? null,
        status: "lead",
      };
      const { data: job, error } = await sb.from("jobs").insert(row).select("id, name").single();
      if (error) return { result: { error: error.message } };
      return { result: { job_id: job.id, name: job.name, action: "created_job" } };
    }
    case "populate_order_form": {
      const jobId = String(args.job_id ?? "");
      const { data: job } = await sb.from("jobs").select("id, property_id, company_id").eq("id", jobId).maybeSingle();
      if (!job) return { result: { error: "Job not found" } };
      if (!job.property_id) return { result: { error: "Job has no linked property/measurement yet." } };
      const { data: meas } = await sb.from("roof_measurements").select("*").eq("property_id", job.property_id).maybeSingle();
      if (!meas) return { result: { error: "No roof measurement saved for this property yet. Complete the Measure tab first." } };

      const derived = deriveInputsFromMeasurement(meas);
      const { data: draft } = await sb
        .from("job_order_drafts")
        .select("id, inputs, manual_input_keys")
        .eq("job_id", jobId)
        .maybeSingle();
      const existing = ((draft?.inputs ?? {}) as Record<string, number>) || {};
      const manualKeys = ((draft?.manual_input_keys ?? []) as string[]) || [];
      const { next, applied, skipped } = mergeDerivedInputs(existing, derived, manualKeys);

      if (draft?.id) {
        await sb.from("job_order_drafts").update({ inputs: next }).eq("id", draft.id);
      } else {
        await sb.from("job_order_drafts").insert({ job_id: jobId, company_id: job.company_id, inputs: next });
      }
      return { result: { applied, skipped, values: next, action: "populated_order_form", job_id: jobId } };
    }
    case "auto_measure_property": {
      const jobId = String(args.job_id ?? "");
      const { autoMeasureJobProperty } = await import("@/lib/auto-measure.functions");
      try {
        const res = await autoMeasureJobProperty({ data: { job_id: jobId } });
        return { result: { ...res, action: "auto_measured_property", job_id: jobId } };
      } catch (e) {
        return { result: { error: e instanceof Error ? e.message : "Auto-measure failed" } };
      }
    }
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

// -------- Model orchestration --------

function systemPrompt(ctx?: IncomingBody["context"]) {
  return `You are the in-app AI copilot for Global Contractor Network, a roofing/construction CRM.
You help users navigate the app and take actions by calling tools.

Rules:
- Be concise. Answer in 1-3 short sentences unless the user asks for detail.
- CAREFULLY READ the user's message and the full conversation before responding. Extract every field they gave (name, address, city, state, zip, phone, email, roof type, damage notes, claim number, carrier, year built, sqft, value). Parse addresses even when written as one line like "2847 NE 2nd Ave Boca Raton FL 33431".
- NEVER re-ask for information the user has already provided in this conversation. Only ask for fields that are truly missing.
- When the user asks to create/update anything, use the appropriate tool immediately with what you have. Only ask a follow-up question if a REQUIRED field is missing.
- Never invent phone numbers, emails, claim numbers, or years — if missing and required, ask once for just those fields.
- After a successful mutation, tell the user briefly what you did and offer a next step.
- For "how do I..." questions, call explain_feature.
- Available routes: ${APP_ROUTES.join(", ")}.
- Current context: ${JSON.stringify(ctx ?? {})}.`;
}

function toOpenAIMessages(sys: string, history: StoredMessage[], userText: string) {
  const out: Array<Record<string, unknown>> = [{ role: "system", content: sys }];
  for (const m of history) {
    if (m.role === "user") {
      const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
      out.push({ role: "user", content: text });
    } else if (m.role === "assistant") {
      const text = m.parts.filter((p) => p.type === "text").map((p) => (p as any).text).join("");
      const toolCalls = m.parts.filter((p) => p.type === "tool_call") as Array<any>;
      const msg: Record<string, unknown> = { role: "assistant", content: text || null };
      if (toolCalls.length) {
        msg.tool_calls = toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
        }));
      }
      out.push(msg);
      const toolResults = m.parts.filter((p) => p.type === "tool_result") as Array<any>;
      for (const tr of toolResults) {
        out.push({ role: "tool", tool_call_id: tr.id, content: JSON.stringify(tr.result) });
      }
    }
  }
  out.push({ role: "user", content: userText });
  return out;
}

async function callGateway(messages: Array<Record<string, unknown>>, apiKey: string) {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, tools: ASSISTANT_TOOLS, tool_choice: "auto" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 300)}`);
  }
  return await res.json();
}

export const Route = createFileRoute("/api/assistant-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.replace("Bearer ", "");

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !LOVABLE_API_KEY) {
          return Response.json({ error: "Server misconfigured" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub as string | undefined;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        let body: IncomingBody;
        try {
          body = (await request.json()) as IncomingBody;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { thread_id, user_message } = body;
        if (!thread_id || !user_message?.trim()) {
          return Response.json({ error: "thread_id and user_message required" }, { status: 400 });
        }

        // Verify thread ownership.
        const { data: thread } = await supabase
          .from("assistant_threads")
          .select("id, title")
          .eq("id", thread_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!thread) return Response.json({ error: "Thread not found" }, { status: 404 });

        // Load history.
        const { data: history } = await supabase
          .from("assistant_messages")
          .select("role, parts")
          .eq("thread_id", thread_id)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        const storedHistory = (history ?? []) as StoredMessage[];

        // Persist user message immediately.
        await supabase.from("assistant_messages").insert({
          thread_id,
          user_id: userId,
          role: "user",
          parts: [{ type: "text", text: user_message }],
        });

        // Run tool loop.
        const assistantParts: ChatMessagePart[] = [];
        const messages = toOpenAIMessages(systemPrompt(body.context), storedHistory, user_message);

        for (let step = 0; step < MAX_STEPS; step++) {
          let json: any;
          try {
            json = await callGateway(messages, LOVABLE_API_KEY);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            assistantParts.push({ type: "text", text: `Sorry — I hit an error talking to the AI service. ${msg}` });
            break;
          }
          const choice = json.choices?.[0]?.message ?? {};
          const content: string | null = choice.content ?? null;
          const toolCalls: any[] = choice.tool_calls ?? [];

          if (content) assistantParts.push({ type: "text", text: String(content) });

          if (!toolCalls.length) break;

          // Append assistant with tool_calls to messages so gateway sees them.
          messages.push({
            role: "assistant",
            content: content ?? null,
            tool_calls: toolCalls,
          });

          for (const tc of toolCalls) {
            const name = tc.function?.name as string;
            let parsed: Record<string, unknown> = {};
            try {
              parsed = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
            } catch {
              parsed = {};
            }
            assistantParts.push({ type: "tool_call", id: tc.id, name, args: parsed });
            const { result } = await runTool(name, parsed, supabase, userId, body.context);
            assistantParts.push({ type: "tool_result", id: tc.id, name, result });
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          }
        }

        // Guarantee at least one text bubble.
        if (!assistantParts.some((p) => p.type === "text")) {
          assistantParts.push({ type: "text", text: "Done." });
        }

        // Persist assistant turn.
        const { data: savedAssistant } = await supabase
          .from("assistant_messages")
          .insert({
            thread_id,
            user_id: userId,
            role: "assistant",
            parts: assistantParts,
          })
          .select("id, role, parts, created_at")
          .single();

        // Bump thread updated_at + auto-title if still default.
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (thread.title === "New chat") {
          patch.title = user_message.slice(0, 60);
        }
        await supabase.from("assistant_threads").update(patch).eq("id", thread_id);

        return Response.json({ message: savedAssistant });
      },
    },
  },
});
