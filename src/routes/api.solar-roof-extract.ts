import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { normalizeTuning, qualityLadder } from "@/lib/measure-tuning";
import {
  fitFacetsToFootprint,
  footprintFromSegmentBoxes,
  carveFootprintByCenters,
  consolidateSegmentCenters,
} from "@/lib/roof-geometry";
import { fetchBuildingFootprint } from "@/lib/footprint.server";
import {
  companyCalibration,
  findNearbyCorrection,
  scaleRing,
} from "@/lib/roof-corrections.server";


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
          force_raw?: boolean;
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

        // Corrections memory: a saved hand-corrected footprint for this house
        // beats anything the satellite fit can produce, so reuse it first.
        const admin = SUPABASE_SERVICE_ROLE_KEY
          ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            })
          : null;

        let calibration = { factor: 1, samples: 0 };
        if (admin) {
          try {
            if (!body.force_raw) {
              const hit = await findNearbyCorrection(admin, {
                lat,
                lng,
                companyId: callerCompanyId,
                propertyId: property_id ?? null,
              });
              if (hit) {
                const facets = hit.corrected_facets;
                const total =
                  Number(hit.corrected_plan_sqft) ||
                  facets.reduce((s, f) => s + Number(f.plan_area_sqft || 0), 0);
                const allPoints = facets.flatMap((f) => f.ring ?? []);
                return Response.json({
                  run_id: null,
                  source: "corrected",
                  correction_id: hit.id,
                  correction_saved_at: hit.created_at,
                  imagery_quality: null,
                  imagery_date: null,
                  total_plan_sqft: Math.round(total),
                  pitch_estimated: false,
                  facet_source: "saved_correction",
                  max_sunshine_hours_per_year: 0,
                  segment_count: facets.length,
                  footprint: allPoints.length >= 3 ? facets[0].ring : [],
                  footprint_source: "saved_correction",
                  segments: facets.map((f, i) => ({
                    index: i,
                    name: `Facet ${i + 1}`,
                    plan_area_sqft: f.plan_area_sqft,
                    pitch: f.pitch,
                    pitch_degrees: f.pitch_degrees,
                    pitch_known: true,
                    azimuth_degrees: 0,
                    ring: f.ring,
                    center: null,
                  })),
                  used_quality: "SAVED_CORRECTION",
                });
              }
            }
            calibration = await companyCalibration(admin, callerCompanyId);
          } catch (err) {
            console.error("roof_corrections lookup failed:", err);
          }
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

        // Building outline — the accuracy of everything downstream depends on it.
        const wantFootprint = tuning.footprint_source !== "boxes";
        const footprintHit = wantFootprint ? await fetchBuildingFootprint(lat, lng, 30) : null;

        if (!success) {
          // Google has no roof data here. If we still know the building outline
          // we can produce a real measurement instead of failing outright.
          if (footprintHit) {
            const fit = fitFacetsToFootprint(footprintHit.ring, [], {
              mergeSmall: tuning.merge_small,
              snapSquare: tuning.snap_square,
              minFacetSqft: tuning.min_facet_sqft,
            });
            if (fit.facets.length > 0) {
              return Response.json({
                imagery_quality: null,
                imagery_date: null,
                total_plan_sqft: fit.plan_area_sqft,
                max_sunshine_hours_per_year: 0,
                segment_count: fit.facets.length,
                footprint: fit.footprint,
                footprint_source: footprintHit.source,
                pitch_estimated: true,
                segments: fit.facets.map((f, i) => ({
                  index: i,
                  name: `Facet ${i + 1}`,
                  plan_area_sqft: f.plan_area_sqft,
                  pitch: f.pitch,
                  pitch_degrees: f.pitch_degrees,
                  azimuth_degrees: f.azimuth_degrees,
                  ring: f.ring,
                  center: null,
                })),
                used_quality: "FOOTPRINT_ONLY",
              });
            }
          }

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
                "No building data for this location. Use Mapbox Draw to measure manually.",
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
        // Drop far-away neighbour roofs and sliver facets before fitting.
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

        const kept = tunedSegments.length ? tunedSegments : rawSegments;

        const totalPlanSqFtReported =
          (data.solarPotential?.wholeRoofStats?.areaMeters2 ?? 0) * sqMeterToSqFt ||
          kept.reduce((s, seg) => s + (seg.stats?.areaMeters2 ?? 0) * sqMeterToSqFt, 0);

        // Fall back to a rotated rectangle around Google's boxes when the
        // building isn't in the vector map — still follows the house angle.
        const footprintRing =
          footprintHit?.ring ??
          footprintFromSegmentBoxes(
            kept
              .filter((s) => s.boundingBox)
              .map((s) => ({
                sw: [s.boundingBox!.sw.longitude, s.boundingBox!.sw.latitude] as [number, number],
                ne: [s.boundingBox!.ne.longitude, s.boundingBox!.ne.latitude] as [number, number],
              })),
            totalPlanSqFtReported,
          );

        // Primary path: carve the REAL footprint with Voronoi cells seeded on
        // Google's segment centres. Every facet is a clip of the true outline,
        // so they tile the house exactly and follow its real shape/angle.
        const carved = footprintRing
          ? carveFootprintByCenters(
              footprintRing,
              consolidateSegmentCenters(
                kept
                  .filter((s) => s.center)
                  .map((s) => ({
                    lng: s.center!.longitude,
                    lat: s.center!.latitude,
                    pitch_degrees:
                      typeof s.pitchDegrees === "number" ? s.pitchDegrees : null,
                    azimuth_degrees: s.azimuthDegrees ?? 0,
                    area_m2: s.stats?.areaMeters2 ?? 0,
                  })),
              ),
              { minFacetSqft: tuning.min_facet_sqft },
            )
          : null;

        const fit =
          carved ??
          (footprintRing
            ? fitFacetsToFootprint(
                footprintRing,
                kept.map((s) => ({
                  azimuth_degrees: s.azimuthDegrees ?? 0,
                  pitch_degrees: s.pitchDegrees ?? 0,
                  area_m2: s.stats?.areaMeters2 ?? 0,
                })),
                {
                  mergeSmall: tuning.merge_small,
                  snapSquare: tuning.snap_square,
                  minFacetSqft: tuning.min_facet_sqft,
                },
              )
            : { facets: [], footprint: [], plan_area_sqft: 0 });

        const segments = fit.facets.map((f, i) => ({
          index: i,
          name: `Facet ${i + 1}`,
          plan_area_sqft: f.plan_area_sqft,
          pitch: f.pitch,
          pitch_degrees: f.pitch_degrees,
          pitch_known: (f as { pitch_known?: boolean }).pitch_known !== false,
          azimuth_degrees: f.azimuth_degrees,
          ring: f.ring,
          center: null as { latitude: number; longitude: number } | null,
        }));

        const pitchUnknown = segments.some((s) => !s.pitch_known);
        const totalPlanSqFt = fit.plan_area_sqft || totalPlanSqFtReported;



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
        let runId: string | null = null;
        if (SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
              auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
            });
            const { data: run } = await admin
              .from("ai_measurement_runs")
              .insert({
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
                raw_response: {
                  ...(data as unknown as Record<string, unknown>),
                  tuning,
                  footprint: fit.footprint,
                  footprint_source: footprintHit?.source ?? "solar_boxes",
                  facet_source: carved ? "footprint_voronoi" : "footprint_faces",
                },
              })
              .select("id")
              .single();
            runId = (run?.id as string | undefined) ?? null;
          } catch (err) {
            console.error("ai_measurement_runs log failed:", err);
          }
        }

        return Response.json({
          run_id: runId,
          imagery_quality: data.imageryQuality ?? success.usedQuality,
          imagery_date: data.imageryDate ?? null,
          total_plan_sqft: totalPlanSqFt,
          pitch_estimated: pitchUnknown,
          facet_source: carved ? "footprint_voronoi" : "footprint_faces",
          max_sunshine_hours_per_year: data.solarPotential?.maxSunshineHoursPerYear ?? 0,
          segment_count: segments.length,
          footprint: fit.footprint,
          footprint_source: footprintHit?.source ?? "solar_boxes",
          segments,
          used_quality: success.usedQuality,
        });

      },
    },
  },
});
