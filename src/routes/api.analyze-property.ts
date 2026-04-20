import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type CatalogRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  default_price: number;
  trade: string;
  category: string | null;
};

type ConsolidatedItem = {
  suggested_code?: string;
  description: string;
  qty: number;
  unit: string;
  confidence: "low" | "medium" | "high";
  product_details?: { material?: string; brand_guess?: string; color?: string };
  condition_notes?: string;
  source_photo_indices?: number[];
};

type AnalysisResult = {
  property_summary?: Record<string, unknown>;
  surfaces?: Array<Record<string, unknown>>;
  consolidated_line_items?: ConsolidatedItem[];
};

export const Route = createFileRoute("/api/analyze-property")({
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
        const userId = claims.claims.sub as string;

        let body: { job_id?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { job_id } = body;
        if (!job_id) return Response.json({ error: "job_id required" }, { status: 400 });

        const { data: job } = await supabase
          .from("jobs")
          .select("id, company_id, primary_trade, price_book_id, jurisdiction")
          .eq("id", job_id)
          .maybeSingle();
        if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

        const { data: photos = [] } = await supabase
          .from("job_photos")
          .select("id, storage_path, tag, trade_hint, caption")
          .eq("job_id", job_id)
          .order("created_at", { ascending: true });

        if (!photos || photos.length === 0) {
          return Response.json({ error: "No photos to analyze" }, { status: 400 });
        }

        const photosToUse = photos.slice(0, 30);

        const signedPhotos: Array<{ id: string; url: string; tag: string | null; index: number }> = [];
        for (let i = 0; i < photosToUse.length; i++) {
          const p = photosToUse[i];
          const { data: signed } = await supabase.storage
            .from("roof-photos")
            .createSignedUrl(p.storage_path, 1800);
          if (signed?.signedUrl) {
            signedPhotos.push({ id: p.id, url: signed.signedUrl, tag: p.tag, index: i });
          }
        }

        if (signedPhotos.length === 0) {
          return Response.json({ error: "Could not sign any photo URLs" }, { status: 500 });
        }

        let q = supabase
          .from("line_item_master")
          .select("id, code, name, unit, default_price, trade, category")
          .eq("status", "active")
          .or(`company_id.eq.${job.company_id},company_id.is.null`)
          .limit(400);
        if (job.primary_trade) q = q.eq("trade", job.primary_trade as never);
        const { data: catalog = [] } = await q;
        const catalogRows = (catalog ?? []) as CatalogRow[];

        const catalogText = catalogRows
          .map((c) => `- [${c.code}] ${c.name} (${c.unit}, ${c.trade})`)
          .join("\n");

        const tools = [
          {
            type: "function",
            function: {
              name: "record_property_analysis",
              description:
                "Record one consolidated, deduplicated analysis covering ALL provided photos as a single property.",
              parameters: {
                type: "object",
                properties: {
                  property_summary: {
                    type: "object",
                    properties: {
                      roof: { type: "string", description: "Material + age + overall condition" },
                      siding: { type: "string" },
                      interior: { type: "string" },
                      exterior: { type: "string" },
                      condition_score: { type: "integer", minimum: 0, maximum: 100 },
                      age_estimate: { type: "string" },
                      notable_concerns: { type: "array", items: { type: "string" } },
                    },
                  },
                  surfaces: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        material: { type: "string" },
                        area_estimate_sf: { type: "number" },
                        squares: { type: "number" },
                        lf: { type: "number" },
                        condition_score: { type: "integer", minimum: 0, maximum: 100 },
                        defects: { type: "array", items: { type: "string" } },
                        source_photo_indices: { type: "array", items: { type: "integer" } },
                      },
                      required: ["name"],
                    },
                  },
                  consolidated_line_items: {
                    type: "array",
                    description:
                      "Deduplicated list of line items for the WHOLE property. Aggregate qty across all photos showing the same surface.",
                    items: {
                      type: "object",
                      properties: {
                        suggested_code: {
                          type: "string",
                          description: "MUST be from the provided catalog when possible.",
                        },
                        description: { type: "string" },
                        qty: { type: "number" },
                        unit: { type: "string" },
                        confidence: { type: "string", enum: ["low", "medium", "high"] },
                        product_details: {
                          type: "object",
                          properties: {
                            material: { type: "string" },
                            brand_guess: { type: "string" },
                            color: { type: "string" },
                          },
                        },
                        condition_notes: { type: "string" },
                        source_photo_indices: {
                          type: "array",
                          items: { type: "integer" },
                          description: "0-based indices of photos this line item came from.",
                        },
                      },
                      required: ["description", "qty", "unit", "confidence"],
                    },
                  },
                },
                required: ["consolidated_line_items"],
              },
            },
          },
        ];

        const photoIndexLines = signedPhotos
          .map((p) => `[${p.index}]${p.tag ? ` tag=${p.tag}` : ""}`)
          .join("  ");

        const userPrompt = `You are a senior residential restoration estimator analyzing ALL the photos below as ONE property.

CRITICAL RULES:
- Treat the photos as ONE property — do NOT produce a per-photo analysis.
- Deduplicate aggressively. If 5 photos show the same roof slope, that is ONE roof, not 5 line items.
- Aggregate quantities ACROSS photos. Estimate squares (1 SQ = 100 SF), linear feet, and counts directly from what you see.
- For ROOF: estimate total squares of comp shingle / underlayment from roof-pitch photos. Include ridge cap LF, valley LF, drip edge LF, and starter LF when visible.
- For SIDING/STUCCO: estimate total SF of affected wall sections.
- For INTERIOR: estimate SF of damaged drywall ceiling/wall and LF of trim.
- For WINDOWS / DOORS: count units.
- Choose suggested_code ONLY from the CATALOG list below. If no catalog code reasonably fits, OMIT the suggested_code field entirely — DO NOT invent codes. A custom item without a code is preferable to a hallucinated code.
- For each line item, list source_photo_indices using the index numbers shown below.
- Mark confidence honestly (low when guessing).

PHOTO INDEX MAP:
${photoIndexLines}

CATALOG (prefer these codes):
${catalogText || "(no items)"}

Return ONE consolidated property analysis via the record_property_analysis tool.`;

        const userContent: Array<Record<string, unknown>> = [{ type: "text", text: userPrompt }];
        for (const p of signedPhotos) {
          userContent.push({ type: "image_url", image_url: { url: p.url } });
        }

        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [{ role: "user", content: userContent }],
            tools,
            tool_choice: { type: "function", function: { name: "record_property_analysis" } },
          }),
        });

        if (!r.ok) {
          const txt = await r.text();
          if (r.status === 429) {
            return Response.json({ error: "Rate limit exceeded — try again in a moment." }, { status: 429 });
          }
          if (r.status === 402) {
            return Response.json({ error: "AI credits exhausted." }, { status: 402 });
          }
          return Response.json(
            { error: "AI gateway error", detail: txt.slice(0, 500) },
            { status: 502 },
          );
        }

        const ai = (await r.json()) as {
          choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
        };
        const args = ai.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        let parsed: AnalysisResult = {};
        try {
          parsed = args ? (JSON.parse(args) as AnalysisResult) : {};
        } catch {
          parsed = {};
        }

        const items = parsed.consolidated_line_items ?? [];
        // Build set of valid catalog codes (company + master) so we can drop hallucinated codes
        const validCodeSet = new Set(catalogRows.map((c) => c.code));
        const codes = items.map((i) => i.suggested_code).filter((c): c is string => !!c);

        let priceMap: Record<string, number> = {};
        let codeToCatalog: Record<string, CatalogRow> = {};
        if (codes.length > 0) {
          const { data: matches = [] } = await supabase
            .from("line_item_master")
            .select("id, code, name, unit, default_price, trade, category")
            .or(`company_id.eq.${job.company_id},company_id.is.null`)
            .in("code", codes);
          codeToCatalog = Object.fromEntries(((matches ?? []) as CatalogRow[]).map((m) => [m.code, m]));

          if (job.price_book_id) {
            const ids = (matches ?? []).map((m) => m.id);
            if (ids.length > 0) {
              const { data: prices = [] } = await supabase
                .from("line_item_prices")
                .select("line_item_master_id, unit_price")
                .eq("price_book_id", job.price_book_id)
                .in("line_item_master_id", ids);
              const idToPrice = Object.fromEntries(
                (prices ?? []).map((p) => [p.line_item_master_id, Number(p.unit_price)]),
              );
              for (const m of matches ?? []) {
                if (idToPrice[m.id] != null) priceMap[m.code] = idToPrice[m.id];
              }
            }
          }
          for (const m of matches ?? []) {
            if (priceMap[m.code] == null) priceMap[m.code] = Number(m.default_price ?? 0);
          }
        }

        const enriched = items.map((it) => {
          // Drop hallucinated codes that don't exist in the catalog
          const codeIfValid =
            it.suggested_code && validCodeSet.has(it.suggested_code)
              ? it.suggested_code
              : undefined;
          const cat = codeIfValid ? codeToCatalog[codeIfValid] : undefined;
          const sourceIds = (it.source_photo_indices ?? [])
            .map((idx) => signedPhotos[idx]?.id)
            .filter((id): id is string => !!id);
          return {
            ...it,
            suggested_code: codeIfValid,
            unit_price: codeIfValid ? priceMap[codeIfValid] ?? null : null,
            catalog_name: cat?.name ?? null,
            catalog_trade: cat?.trade ?? null,
            source_photo_ids: sourceIds,
          };
        });

        const finalAnalysis = {
          ...parsed,
          consolidated_line_items: enriched,
          analyzed_photo_ids: signedPhotos.map((p) => p.id),
        };

        const { data: inserted, error: insErr } = await supabase
          .from("job_property_analyses")
          .insert({
            job_id,
            company_id: job.company_id,
            analysis: finalAnalysis,
            photo_count: signedPhotos.length,
            created_by: userId,
          })
          .select("id, created_at")
          .single();
        if (insErr) {
          return Response.json({ error: insErr.message }, { status: 500 });
        }

        return Response.json({
          id: inserted.id,
          created_at: inserted.created_at,
          analysis: finalAnalysis,
          photo_count: signedPhotos.length,
        });
      },
    },
  },
});
