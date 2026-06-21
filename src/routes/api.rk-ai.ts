import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type PolishPayload = {
  customer?: string;
  roof_type?: string;
  reported_concern?: string;
  raw_notes?: string;
  ticket_id?: string;
};

type FormPayload = { prompt?: string };

type Body = { action?: "polish" | "form"; payload?: PolishPayload | FormPayload };

const ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";

async function callClaude(opts: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: opts.maxTokens ?? 1400,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Anthropic error ${r.status}: ${txt}`);
  }
  const json = (await r.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
  return text;
}

export const Route = createFileRoute("/api/rk-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.replace("Bearer ", "");

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!ANTHROPIC_KEY) {
          return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Verify caller is a member of a Roof King company
        const { data: prof } = await supabase
          .from("profiles")
          .select("company_id, role")
          .eq("id", claims.claims.sub)
          .maybeSingle();
        if (!prof) return new Response("Forbidden", { status: 403 });
        if (prof.role !== "super_admin") {
          const { data: co } = await supabase
            .from("companies")
            .select("is_roof_king")
            .eq("id", prof.company_id ?? "")
            .maybeSingle();
          if (!co?.is_roof_king) return new Response("Forbidden", { status: 403 });
        }

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (body.action === "polish") {
          const p = (body.payload ?? {}) as PolishPayload;
          const system =
            "You are the office manager at Roof King, a commercial roofing company. Rewrite crew field notes into a clear, professional service report suitable for both the customer and the invoice. Keep ALL technical facts, materials, locations, quantities, and measurements exactly as written. Fix grammar and spelling. Organize the output strictly as four short sections with these exact headers on their own lines: Issue, Root Cause, Work Performed, Recommendations. Do not invent details, prices, or work that wasn't in the notes. If a section has no information, write 'Not specified.' Return only the rewritten report — no preamble, no closing remarks.";
          const user = [
            p.customer ? `Customer: ${p.customer}` : null,
            p.roof_type ? `Roof Type: ${p.roof_type}` : null,
            p.reported_concern ? `Reported Concern: ${p.reported_concern}` : null,
            "",
            "Raw Field Notes:",
            p.raw_notes ?? "",
          ]
            .filter((x) => x !== null)
            .join("\n");

          try {
            const text = await callClaude({ apiKey: ANTHROPIC_KEY, system, user });

            // If ticket_id provided, persist polished report + advance status
            if (p.ticket_id) {
              const { data: tk } = await supabase
                .from("rk_tickets")
                .select("status")
                .eq("id", p.ticket_id)
                .maybeSingle();
              const update: { report_polished: string; status?: string } = { report_polished: text };
              if (tk && (tk.status === "new" || tk.status === "dispatched" || tk.status === "field")) {
                update.status = "ready";
              }
              await supabase.from("rk_tickets").update(update).eq("id", p.ticket_id);
            }

            return Response.json({ text });
          } catch (e) {
            return Response.json(
              { error: e instanceof Error ? e.message : "AI request failed" },
              { status: 502 },
            );
          }
        }

        if (body.action === "form") {
          const p = (body.payload ?? {}) as FormPayload;
          if (!p.prompt || !p.prompt.trim()) {
            return Response.json({ error: "prompt required" }, { status: 400 });
          }
          const system =
            'You design service forms for a commercial roofing company. Return ONLY a single valid JSON object — no prose, no markdown, no code fences. The object MUST have this exact shape: {"name": string, "description": string, "fields": [{"label": string, "type": "text"|"textarea"|"number"|"date"|"select"|"checkbox", "options": string[]}]}. Include 6 to 12 practical fields suited to a roofing crew working in the field. Always include `options` (empty array unless type is select). Field labels should be short and human (e.g. "Roof Type", "Drain Condition"). Output JSON only.';
          try {
            const text = await callClaude({ apiKey: ANTHROPIC_KEY, system, user: p.prompt, maxTokens: 1600 });
            // Tolerate stray fences
            const cleaned = text
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/```\s*$/i, "")
              .trim();
            let parsed: unknown;
            try {
              parsed = JSON.parse(cleaned);
            } catch {
              return Response.json({ error: "AI returned invalid JSON", raw: text }, { status: 502 });
            }
            return Response.json({ template: parsed });
          } catch (e) {
            return Response.json(
              { error: e instanceof Error ? e.message : "AI request failed" },
              { status: 502 },
            );
          }
        }

        return Response.json({ error: "Unknown action" }, { status: 400 });
      },
    },
  },
});
