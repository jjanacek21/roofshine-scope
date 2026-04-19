import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

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
        const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        if (!GOOGLE_KEY) {
          return Response.json({ error: "Google Maps API key not configured" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        let body: { lat?: number; lng?: number };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { lat, lng } = body;
        if (typeof lat !== "number" || typeof lng !== "number") {
          return Response.json({ error: "lat & lng required" }, { status: 400 });
        }

        const url =
          `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
          `?location.latitude=${lat}&location.longitude=${lng}` +
          `&requiredQuality=HIGH&key=${GOOGLE_KEY}`;

        const r = await fetch(url);
        if (!r.ok) {
          const txt = await r.text();
          return Response.json(
            { error: "Solar API error", status: r.status, detail: txt.slice(0, 500) },
            { status: 502 },
          );
        }
        const data = (await r.json()) as {
          solarPotential?: {
            wholeRoofStats?: { areaMeters2?: number };
            roofSegmentStats?: Array<{
              pitchDegrees?: number;
              azimuthDegrees?: number;
              stats?: { areaMeters2?: number };
              boundingBox?: {
                sw: { latitude: number; longitude: number };
                ne: { latitude: number; longitude: number };
              };
              center?: { latitude: number; longitude: number };
            }>;
          };
          imageryQuality?: string;
          imageryDate?: { year: number; month: number; day: number };
        };

        const sqMeterToSqFt = 10.7639;
        const segments = (data.solarPotential?.roofSegmentStats ?? []).map((seg, i) => {
          const planSqM = seg.stats?.areaMeters2 ?? 0;
          // Solar API areas are PLAN (horizontal projection)
          const planSqFt = planSqM * sqMeterToSqFt;
          const pitchDeg = seg.pitchDegrees ?? 0;
          // Convert pitch degrees → rise/12 (nearest int)
          const rise = Math.round(Math.tan((pitchDeg * Math.PI) / 180) * 12);
          const pitchStr = `${Math.max(0, Math.min(12, rise))}/12`;
          // Build a polygon ring from bounding box (4 corners)
          const bb = seg.boundingBox;
          const ring = bb
            ? [
                [bb.sw.longitude, bb.sw.latitude],
                [bb.ne.longitude, bb.sw.latitude],
                [bb.ne.longitude, bb.ne.latitude],
                [bb.sw.longitude, bb.ne.latitude],
                [bb.sw.longitude, bb.sw.latitude],
              ]
            : [];
          return {
            index: i,
            name: `Segment ${i + 1}`,
            plan_area_sqft: planSqFt,
            pitch: pitchStr,
            pitch_degrees: pitchDeg,
            azimuth_degrees: seg.azimuthDegrees ?? 0,
            ring,
            center: seg.center ?? null,
          };
        });

        const totalPlanSqFt = (data.solarPotential?.wholeRoofStats?.areaMeters2 ?? 0) * sqMeterToSqFt;

        return Response.json({
          imagery_quality: data.imageryQuality ?? null,
          imagery_date: data.imageryDate ?? null,
          total_plan_sqft: totalPlanSqFt,
          segment_count: segments.length,
          segments,
        });
      },
    },
  },
});
