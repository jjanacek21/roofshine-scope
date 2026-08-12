import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * HTTP wrapper only. The measurement engine itself lives in
 * src/lib/solar-extract.server.ts (runSolarRoofExtract) so that the
 * GlobalContractor job flow and Claim Buddy run the exact same code.
 */
export const Route = createFileRoute("/api/solar-roof-extract")({
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
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        let body: {
          lat?: number;
          lng?: number;
          property_id?: string;
          job_id?: string;
          tuning?: unknown;
          force_raw?: boolean;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { lat, lng, property_id, job_id } = body;
        if (typeof lat !== "number" || typeof lng !== "number") {
          return Response.json({ error: "lat & lng required" }, { status: 400 });
        }

        const { runSolarRoofExtract } = await import("@/lib/solar-extract.server");
        const result = await runSolarRoofExtract({
          supabase,
          userId: claims.claims.sub,
          lat,
          lng,
          property_id,
          job_id,
          tuning: body.tuning,
          force_raw: body.force_raw,
        });
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});
