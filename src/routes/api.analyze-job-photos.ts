import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/analyze-job-photos")({
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
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!LOVABLE_API_KEY) {
          return Response.json({ error: "LOVABLE_API_KEY not configured" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        let body: { photo_id?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { photo_id } = body;
        if (!photo_id) return Response.json({ error: "photo_id required" }, { status: 400 });

        // Load photo + job + price book context
        const { data: photo } = await supabase
          .from("job_photos")
          .select("*, jobs!inner(id, primary_trade, price_book_id, company_id)")
          .eq("id", photo_id)
          .maybeSingle();
        if (!photo) return Response.json({ error: "Photo not found" }, { status: 404 });

        // Signed URL for the photo
        const { data: signed } = await supabase.storage
          .from("roof-photos")
          .createSignedUrl(photo.storage_path, 600);
        if (!signed?.signedUrl) {
          return Response.json({ error: "Could not sign photo URL" }, { status: 500 });
        }

        // Fetch line item catalog (limit + filter by trade hint when present)
        const job = (photo as unknown as { jobs: { primary_trade: string | null; price_book_id: string | null; company_id: string } }).jobs;
        let q = supabase
          .from("line_item_master")
          .select("id, code, name, unit, default_price, trade, category")
          .eq("status", "active")
          .limit(150);
        const tradeHint = photo.trade_hint ?? job.primary_trade;
        if (tradeHint) q = q.eq("trade", tradeHint as never);
        const { data: catalog = [] } = await q;

        const catalogText = (catalog ?? [])
          .map((c) => `- [${c.code}] ${c.name} (${c.unit}, ${c.trade})`)
          .join("\n");

        const tools = [
          {
            type: "function",
            function: {
              name: "match_line_items",
              description: "Match photo content to catalog line items",
              parameters: {
                type: "object",
                properties: {
                  observed_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        suggested_code: { type: "string" },
                        suggested_qty: { type: "number" },
                        unit: { type: "string" },
                        confidence: { type: "string", enum: ["low", "medium", "high"] },
                        needs_user_input: {
                          type: "array",
                          items: { type: "string", enum: ["size", "quantity", "length", "area"] },
                        },
                      },
                      required: ["description", "confidence"],
                    },
                  },
                  trade_detected: { type: "string" },
                  damage_notes: { type: "string" },
                },
                required: ["observed_items"],
              },
            },
          },
        ];

        const userPrompt = `You are an experienced field estimator. Look at this job photo and identify roofing/construction items visible. For each, suggest the best matching line-item code from the catalog below. If you cannot guess size or quantity from the photo, list them in needs_user_input so we can prompt the user.\n\nCATALOG:\n${catalogText || "(no items)"}\n\nReturn JSON via match_line_items.`;

        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: userPrompt },
                  { type: "image_url", image_url: { url: signed.signedUrl } },
                ],
              },
            ],
            tools,
            tool_choice: { type: "function", function: { name: "match_line_items" } },
          }),
        });
        if (!r.ok) {
          const txt = await r.text();
          return Response.json({ error: "AI gateway error", status: r.status, detail: txt.slice(0, 500) }, { status: 502 });
        }
        const ai = (await r.json()) as {
          choices?: Array<{
            message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
          }>;
        };
        const args = ai.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = args ? JSON.parse(args) : {};
        } catch {
          parsed = {};
        }

        await supabase
          .from("job_photos")
          .update({
            ai_analysis: parsed,
            matched_line_items: (parsed.observed_items as unknown) ?? [],
            status: "analyzed",
          })
          .eq("id", photo_id);

        return Response.json({ analysis: parsed });
      },
    },
  },
});
