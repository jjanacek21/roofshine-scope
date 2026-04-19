import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/analyze-roof-condition")({
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
        const MAPBOX_TOKEN = process.env.MAPBOX_API_TOKEN;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!ANTHROPIC_KEY) {
          return Response.json({ error: "Anthropic key not configured" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        let body: {
          property_id?: string;
          lat?: number;
          lng?: number;
          photo_urls?: string[];
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { property_id, lat, lng, photo_urls = [] } = body;
        if (!property_id || typeof lat !== "number" || typeof lng !== "number") {
          return Response.json({ error: "property_id, lat, lng required" }, { status: 400 });
        }

        // Build content array: satellite static image + any provided photos
        const images: Array<{
          type: "image";
          source: { type: "url"; url: string };
        }> = [];

        if (MAPBOX_TOKEN) {
          const sat = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},20,0/640x640@2x?access_token=${MAPBOX_TOKEN}`;
          images.push({ type: "image", source: { type: "url", url: sat } });
        }
        for (const url of photo_urls.slice(0, 8)) {
          images.push({ type: "image", source: { type: "url", url } });
        }

        const systemPrompt = `You are a senior roofing inspector and insurance damage adjuster. Analyze the roof from satellite imagery and any provided ground-level photos. Return JSON via the report_condition tool.`;

        const userText = `Analyze this roof. The first image is a satellite view; subsequent images (if any) are ground/close-up photos. Identify visible damage, estimate overall condition, and recommend trades that should be involved (roofing, gutters, exterior, etc.).`;

        const tools = [
          {
            name: "report_condition",
            description: "Report roof condition assessment",
            input_schema: {
              type: "object",
              properties: {
                overall_condition: {
                  type: "string",
                  enum: ["excellent", "good", "fair", "poor", "failed"],
                },
                roof_material_guess: { type: "string" },
                approximate_age_years: { type: "number" },
                damages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      severity: { type: "string", enum: ["minor", "moderate", "severe"] },
                      location_hint: { type: "string" },
                      evidence_image_index: { type: "number" },
                    },
                    required: ["type", "severity"],
                  },
                },
                recommended_trades: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["roofing", "exterior", "windows", "interior", "hvac", "plumbing", "electrical", "mitigation"],
                  },
                },
                summary: { type: "string" },
              },
              required: ["overall_condition", "damages", "recommended_trades", "summary"],
            },
          },
        ];

        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 2000,
            system: systemPrompt,
            tools,
            tool_choice: { type: "tool", name: "report_condition" },
            messages: [
              {
                role: "user",
                content: [...images, { type: "text", text: userText }],
              },
            ],
          }),
        });
        if (!r.ok) {
          const txt = await r.text();
          return Response.json({ error: "Anthropic error", status: r.status, detail: txt.slice(0, 500) }, { status: 502 });
        }
        const result = (await r.json()) as {
          content: Array<{ type: string; name?: string; input?: unknown }>;
        };
        const toolBlock = result.content.find((b) => b.type === "tool_use" && b.name === "report_condition");
        const analysis = (toolBlock?.input ?? {}) as Record<string, unknown>;

        // Persist to roof_measurements.ai_analysis
        await supabase
          .from("roof_measurements")
          .update({ ai_analysis: analysis })
          .eq("property_id", property_id);

        return Response.json({ analysis });
      },
    },
  },
});
