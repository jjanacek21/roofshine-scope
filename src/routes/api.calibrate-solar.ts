import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * AI calibration endpoint — best-effort wrapper that returns calibrated totals
 * when nearby training examples exist. Falls back to raw Solar numbers otherwise.
 */
export const Route = createFileRoute("/api/calibrate-solar")({
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
        const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        let body: { lat?: number; lng?: number; solar_response?: { total_plan_sqft?: number; segments?: unknown[] } };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { lat, lng, solar_response } = body;
        if (typeof lat !== "number" || typeof lng !== "number" || !solar_response) {
          return Response.json({ error: "lat, lng, solar_response required" }, { status: 400 });
        }

        const rawTotal = Number(solar_response.total_plan_sqft ?? 0);

        // Look up nearby training examples (admin client to bypass RLS for read-only nearest-neighbor)
        let examples: Array<{ ground_truth: Record<string, unknown>; solar_response: Record<string, unknown>; lat: number; lng: number }> = [];
        if (SERVICE_ROLE) {
          const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          // Bounding box of ~1 mile (~0.0145 deg)
          const { data } = await admin
            .from("training_examples")
            .select("ground_truth, solar_response, lat, lng")
            .gte("lat", lat - 0.0145)
            .lte("lat", lat + 0.0145)
            .gte("lng", lng - 0.0145)
            .lte("lng", lng + 0.0145)
            .limit(20);
          examples = (data ?? []) as typeof examples;
        }

        // No examples → just echo raw
        if (examples.length === 0) {
          return Response.json({
            raw_total_sqft: rawTotal,
            calibrated_total_sqft: null,
            example_count: 0,
            rationale: null,
          });
        }

        // Compute simple median correction factor (ground_truth.total_sqft / solar.total_plan_sqft)
        const factors: number[] = [];
        for (const ex of examples) {
          const gt = Number((ex.ground_truth as { total_sqft?: number }).total_sqft ?? 0);
          const sr = Number((ex.solar_response as { total_plan_sqft?: number }).total_plan_sqft ?? 0);
          if (gt > 0 && sr > 0) factors.push(gt / sr);
        }
        if (factors.length === 0) {
          return Response.json({
            raw_total_sqft: rawTotal,
            calibrated_total_sqft: null,
            example_count: examples.length,
            rationale: "Nearby examples missing comparable totals",
          });
        }
        factors.sort((a, b) => a - b);
        const median = factors[Math.floor(factors.length / 2)];
        const calibrated = rawTotal * median;

        return Response.json({
          raw_total_sqft: rawTotal,
          calibrated_total_sqft: Math.round(calibrated),
          example_count: examples.length,
          rationale: `Applied median correction factor ${median.toFixed(3)}× from ${factors.length} nearby example${factors.length === 1 ? "" : "s"}`,
          // LOVABLE_API_KEY reserved for future LLM-based per-facet calibration
          _llm_ready: !!LOVABLE_API_KEY,
        });
      },
    },
  },
});
