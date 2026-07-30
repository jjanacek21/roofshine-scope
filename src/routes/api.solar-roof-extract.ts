import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { normalizeTuning, qualityLadder } from "@/lib/measure-tuning";

type SolarApiResponse = {
  solarPotential?: {
    maxSunshineHoursPerYear?: number;
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

type SolarAttempt = {
  lat: number;
  lng: number;
  quality: "HIGH" | "MEDIUM" | "LOW";
};

async function trySolar(
  attempt: SolarAttempt,
  apiKey: string,
): Promise<{ ok: true; data: SolarApiResponse } | { ok: false; status: number; detail: string }> {
  const url =
    `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
    `?location.latitude=${attempt.lat}&location.longitude=${attempt.lng}` +
    `&requiredQuality=${attempt.quality}&key=${apiKey}`;
  const r = await fetch(url);
  if (!r.ok) {
    const txt = await r.text();
    return { ok: false, status: r.status, detail: txt.slice(0, 500) };
  }
  return { ok: true, data: (await r.json()) as SolarApiResponse };
}

// ~10 meters in degrees latitude
const METERS_TO_DEG_LAT = 1 / 111_320;

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
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

        let body: {
          lat?: number;
          lng?: number;
          property_id?: string;
          job_id?: string;
          tuning?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const { lat, lng, property_id, job_id } = body;
        const tuning = normalizeTuning(body.tuning);
        if (typeof lat !== "number" || typeof lng !== "number") {
          return Response.json({ error: "lat & lng required" }, { status: 400 });
        }

        // Look up the caller's company so we can scope the AI run log
        let callerCompanyId: string | null = null;
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("id", claims.claims.sub)
            .maybeSingle();
          callerCompanyId = (prof?.company_id as string | null) ?? null;
        } catch {
          // ignore
        }

        // Build attempt order: quality fallback at the original point, then
        // small offsets (~10 m) around the point at MEDIUM quality. This
        // handles the common case where the address pin lands on a
        // driveway/pool cage instead of the roof centroid.
        const dLat = 10 * METERS_TO_DEG_LAT;
        const dLng = dLat / Math.max(0.1, Math.cos((lat * Math.PI) / 180));

        const ladder = qualityLadder(tuning.imagery_quality);
        const offsetQuality = ladder[ladder.length - 1];
        const attempts: SolarAttempt[] = [
          ...ladder.map((quality) => ({ lat, lng, quality })),
          { lat: lat + dLat, lng, quality: offsetQuality },
          { lat: lat - dLat, lng, quality: offsetQuality },
          { lat, lng: lng + dLng, quality: offsetQuality },
          { lat, lng: lng - dLng, quality: offsetQuality },
        ];

        let success: { data: SolarApiResponse; usedQuality: string } | null = null;
        let lastNon404: { status: number; detail: string } | null = null;

        for (const att of attempts) {
          const r = await trySolar(att, GOOGLE_KEY);
          if (r.ok) {
            success = { data: r.data, usedQuality: att.quality };
            break;
          }
          if (r.status !== 404) {
            lastNon404 = { status: r.status, detail: r.detail };
            // Non-404 errors (auth, quota, 5xx) are not coverage gaps — bail.
            break;
          }
        }

        if (!success) {
          // True coverage gap (or upstream error). Log to training_examples
          // for super admins to prioritize manual measurement.
          if (SUPABASE_SERVICE_ROLE_KEY && !lastNon404) {
            try {
              const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
              });
              await admin.from("training_examples").insert({
                address: `Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}`,
                lat,
                lng,
                source: "solar_coverage_gap",
                solar_response: { error: "no_coverage", attempts: attempts.length },
                ground_truth: {},
                created_by: claims.claims.sub,
              });
            } catch {
              // best-effort logging
            }
          }

          if (lastNon404) {
            return Response.json(
              {
                error: "solar_api_error",
                status: lastNon404.status,
                detail: lastNon404.detail,
              },
              { status: 502 },
            );
          }

          return Response.json(
            {
              error: "no_coverage",
              message:
                "Google Solar has no building data for this location. Use Mapbox Draw to measure manually.",
              address_lat: lat,
              address_lng: lng,
            },
            { status: 404 },
          );
        }

        const data = success.data;
        const sqMeterToSqFt = 10.7639;
        const M_PER_DEG_LAT = 111_320;
        const FT_PER_M = 3.28084;

        const rawSegments = data.solarPotential?.roofSegmentStats ?? [];
        // Apply the job's edge-detection tuning: drop far-away neighbour roofs
        // and sliver facets before building geometry.
        const tunedSegments = rawSegments.filter((seg) => {
          const areaSqft = (seg.stats?.areaMeters2 ?? 0) * sqMeterToSqFt;
          if (areaSqft < tuning.min_facet_sqft) return false;
          const c = seg.center;
          if (!c) return true;
          const dy = (c.latitude - lat) * M_PER_DEG_LAT;
          const dx =
            (c.longitude - lng) * M_PER_DEG_LAT * Math.max(0.1, Math.cos((lat * Math.PI) / 180));
          return Math.hypot(dx, dy) * FT_PER_M <= tuning.max_facet_radius_ft;
        });

        const segments = (tunedSegments.length ? tunedSegments : rawSegments).map((seg, i) => {
          const planSqM = seg.stats?.areaMeters2 ?? 0;
          const planSqFt = planSqM * sqMeterToSqFt;
          const pitchDeg = seg.pitchDegrees ?? 0;
          const rise = Math.round(Math.tan((pitchDeg * Math.PI) / 180) * 12);
          const pitchStr = `${Math.max(0, Math.min(12, rise))}/12`;
          const bb = seg.boundingBox;
          // Google returns an axis-aligned bounding box per segment, which is
          // wider than the facet on diagonal/hipped roofs. Fit it to the
          // reported area, then apply the job's edge-tightness setting.
          let ring: number[][] = [];
          if (bb) {
            const cLat = seg.center?.latitude ?? (bb.sw.latitude + bb.ne.latitude) / 2;
            const cLng = seg.center?.longitude ?? (bb.sw.longitude + bb.ne.longitude) / 2;
            const mPerDegLng = M_PER_DEG_LAT * Math.max(0.1, Math.cos((cLat * Math.PI) / 180));
            let halfLat = Math.abs(bb.ne.latitude - bb.sw.latitude) / 2;
            let halfLng = Math.abs(bb.ne.longitude - bb.sw.longitude) / 2;
            const boxM2 = halfLat * 2 * M_PER_DEG_LAT * (halfLng * 2 * mPerDegLng);
            let k = tuning.edge_tightness;
            if (boxM2 > 0 && planSqM > 0 && boxM2 > planSqM) k *= Math.sqrt(planSqM / boxM2);
            halfLat *= k;
            halfLng *= k;
            ring = [
              [cLng - halfLng, cLat - halfLat],
              [cLng + halfLng, cLat - halfLat],
              [cLng + halfLng, cLat + halfLat],
              [cLng - halfLng, cLat + halfLat],
              [cLng - halfLng, cLat - halfLat],
            ];
          }
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

        const totalPlanSqFt =
          (data.solarPotential?.wholeRoofStats?.areaMeters2 ?? 0) * sqMeterToSqFt;

        // Compute pitch-adjusted total + predominant pitch for the AI run log
        let totalActualSqFt = 0;
        const pitchTotals: Record<string, number> = {};
        for (const seg of segments) {
          const rise = Math.tan((seg.pitch_degrees * Math.PI) / 180) * 12;
          const mult = Math.sqrt(1 + Math.pow(rise / 12, 2));
          totalActualSqFt += seg.plan_area_sqft * mult;
          pitchTotals[seg.pitch] = (pitchTotals[seg.pitch] ?? 0) + seg.plan_area_sqft;
        }
        const predominantPitch =
          Object.entries(pitchTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        // Best-effort log every successful AI run (uses service role to bypass RLS)
        if (SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            });
            await admin.from("ai_measurement_runs").insert({
              requested_lat: lat,
              requested_lng: lng,
              property_id: property_id ?? null,
              job_id: job_id ?? null,
              company_id: callerCompanyId,
              user_id: claims.claims.sub,
              provider: "google_solar",
              status: "success",
              imagery_quality: data.imageryQuality ?? success.usedQuality,
              imagery_date: data.imageryDate ?? null,
              total_plan_sqft: totalPlanSqFt,
              total_actual_sqft: totalActualSqFt,
              predominant_pitch: predominantPitch,
              segment_count: segments.length,
              segments,
              // tuning that produced this run, for the training centre
              
              raw_response: data as unknown as Record<string, unknown>,
            });
          } catch (err) {
            console.error("ai_measurement_runs log failed:", err);
          }
        }

        return Response.json({
          imagery_quality: data.imageryQuality ?? success.usedQuality,
          imagery_date: data.imageryDate ?? null,
          total_plan_sqft: totalPlanSqFt,
          max_sunshine_hours_per_year: data.solarPotential?.maxSunshineHoursPerYear ?? 0,
          segment_count: segments.length,
          segments,
          used_quality: success.usedQuality,
        });
      },
    },
  },
});
