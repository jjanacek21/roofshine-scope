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

        const { data: photo } = await supabase
          .from("job_photos")
          .select("*, jobs!inner(id, primary_trade, price_book_id, company_id)")
          .eq("id", photo_id)
          .maybeSingle();
        if (!photo) return Response.json({ error: "Photo not found" }, { status: 404 });

        const { data: signed } = await supabase.storage
          .from("roof-photos")
          .createSignedUrl(photo.storage_path, 600);
        if (!signed?.signedUrl) {
          return Response.json({ error: "Could not sign photo URL" }, { status: 500 });
        }

        const job = (photo as unknown as { jobs: { primary_trade: string | null; price_book_id: string | null; company_id: string } }).jobs;

        // Pull both company-scoped catalog AND master fallback so suggestions resolve cleanly.
        const tradeHint = photo.trade_hint ?? job.primary_trade;
        let q = supabase
          .from("line_item_master")
          .select("id, code, name, unit, default_price, trade, category")
          .eq("status", "active")
          .or(`company_id.eq.${job.company_id},company_id.is.null`)
          .limit(250);
        if (tradeHint) q = q.eq("trade", tradeHint as never);
        const { data: catalog = [] } = await q;

        const catalogText = (catalog ?? [])
          .map((c) => `- [${c.code}] ${c.name} (${c.unit}, ${c.trade})`)
          .join("\n");

        const tools = [
          {
            type: "function",
            function: {
              name: "analyze_photo",
              description: "Records a structured construction/damage analysis of a single photo.",
              parameters: {
                type: "object",
                properties: {
                  trade_detected: {
                    type: "string",
                    enum: ["roofing", "exterior", "windows", "interior", "hvac", "plumbing", "electrical", "mitigation", "other"],
                  },
                  asset_type: { type: "string", description: "e.g. asphalt shingle roof, vinyl siding, double-hung window, drywall ceiling" },
                  material: { type: "string" },
                  roof_system: {
                    type: "string",
                    enum: [
                      "laminated_shingle","3tab_shingle","concrete_tile","clay_tile",
                      "metal_standing_seam","metal_screw_down","modified_bitumen",
                      "tpo","epdm","spf","coating","unknown",
                    ],
                    description: "REQUIRED for roofing photos. Identify the roof covering type.",
                  },
                  condition_score: { type: "integer", minimum: 0, maximum: 100, description: "0=destroyed, 100=new" },
                  estimated_age_range: { type: "string" },
                  observed_defects: {
                    type: "array",
                    items: { type: "string" },
                    description: "Only defects ACTUALLY visible. Never invent.",
                  },
                  severity: { type: "string", enum: ["cosmetic", "minor", "moderate", "major", "critical"] },
                  probable_cause: { type: "string" },
                  recommended_actions: { type: "array", items: { type: "string" } },
                  safety_concerns: { type: "array", items: { type: "string" } },
                  observed_items: {
                    type: "array",
                    description: "ONLY damage-specific or photo-unique items (e.g. 'replace 2 SQ shingles in southeast slope', 'reset bent ridge vent', 'damaged pipe boot'). DO NOT include standard roof components like starter, drip edge, field shingles, ridge cap, underlayment, permit, taxes — those are added once at the job level. DO NOT repeat the same item across multiple photos.",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        suggested_code: { type: "string", description: "MUST be a code from the catalog list when possible" },
                        suggested_qty: { type: "number", description: "Always provide. Estimate visible area/length/count even if approximate." },
                        unit: { type: "string" },
                        confidence: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["description", "suggested_code", "suggested_qty", "unit", "confidence"],
                    },
                  },
                  damage_notes: { type: "string" },
                  overall_confidence: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["observed_items", "trade_detected", "condition_score", "observed_defects"],
              },
            },
          },
        ];

        const userPrompt = `You are a senior residential restoration estimator. Analyze this jobsite photo for damage and required repairs.

GUIDANCE:
- Identify the trade (roofing, exterior siding/stucco, windows, interior drywall/flooring, HVAC, plumbing, electrical, water mitigation).
- For ROOF photos: ALWAYS set roof_system (laminated_shingle, 3tab_shingle, concrete_tile, clay_tile, metal_standing_seam, metal_screw_down, modified_bitumen, tpo, epdm, spf, coating).
- Score condition 0-100. Be conservative when image is unclear.
- DAMAGE-ONLY observed_items: Report only what is uniquely visible in THIS photo (specific damaged shingles, a bent vent, a cracked tile, a torn pipe boot). DO NOT list field shingles, starter, drip edge, hip & ridge, underlayment, permit, taxes — those are added once at the job level.
- DO NOT repeat the same line item that would obviously appear in many photos (e.g. "drip edge" on every eave shot). One photo, unique findings only.
- Always include suggested_qty when reporting damage. Mark confidence=low when guessing.
- Florida-specific: hurricane uplift patterns, HVHZ requirements, stucco hairline cracking, flat-roof ponding, humidity-driven mold.

CATALOG (use these codes when matching):
${catalogText || "(no items)"}

Return your analysis via the analyze_photo tool.`;


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
            tool_choice: { type: "function", function: { name: "analyze_photo" } },
          }),
        });
        if (!r.ok) {
          const txt = await r.text();
          return Response.json({ error: "AI gateway error", status: r.status, detail: txt.slice(0, 500) }, { status: 502 });
        }
        const ai = (await r.json()) as {
          choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
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
            trade_hint: (parsed.trade_detected as string) ?? photo.trade_hint,
            status: "analyzed",
          })
          .eq("id", photo_id);

        // If company has auto-add enabled, fire-and-forget the auto-add endpoint.
        // Reuses the same auth token so RLS still applies as the original user.
        const { data: companyRow } = await supabase
          .from("companies")
          .select("auto_add_photo_suggestions")
          .eq("id", job.company_id)
          .maybeSingle();
        if (companyRow?.auto_add_photo_suggestions) {
          const origin = new URL(request.url).origin;
          fetch(`${origin}/api/auto-add-photo-suggestions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ job_id: (photo as unknown as { job_id: string }).job_id }),
          }).catch((err) => console.warn("auto-add suggestions failed", err));
        }

        return Response.json({ analysis: parsed });
      },
    },
  },
});
