import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function extractRoofObservations(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = lines
    .filter((line) => /^([-•*]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^([-•*]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 4);
  if (bullets.length >= 2) return bullets.slice(0, 10);
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 15)
    .slice(0, 8);
}

/** Google Solar API — building insights at a coordinate */
export const getRoofMeasurements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured");
    // Try HIGH quality first, fall back to MEDIUM then LOW for buildings with less coverage
    const qualities = ["HIGH", "MEDIUM", "LOW"] as const;
    let r: Response | null = null;
    let lastTxt = "";
    for (const q of qualities) {
      const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${data.lat}&location.longitude=${data.lng}&requiredQuality=${q}&key=${apiKey}`;
      r = await fetch(url);
      if (r.ok) break;
      lastTxt = await r.text();
    }
    if (!r || !r.ok) {
      return {
        ok: false as const,
        error: `No roof data available for this location. Google Solar API has limited coverage outside major US metros. (${r?.status ?? "no response"}: ${lastTxt.slice(0, 150)})`,
      };
    }
    const json = (await r.json()) as {
      solarPotential?: {
        maxArrayAreaMeters2?: number;
        maxSunshineHoursPerYear?: number;
        roofSegmentStats?: {
          pitchDegrees?: number;
          azimuthDegrees?: number;
          stats?: { areaMeters2?: number };
        }[];
      };
    };
    const sp = json.solarPotential;
    const segments = (sp?.roofSegmentStats ?? []).map((s) => ({
      pitch: s.pitchDegrees ?? 0,
      azimuth: s.azimuthDegrees ?? 0,
      area_sqft: (s.stats?.areaMeters2 ?? 0) * 10.7639,
    }));
    const total_sqft = (sp?.maxArrayAreaMeters2 ?? 0) * 10.7639;
    const avgPitch =
      segments.length > 0
        ? segments.reduce((a, s) => a + s.pitch, 0) / segments.length
        : 0;
    return {
      ok: true as const,
      total_sqft,
      sun_hours_per_year: sp?.maxSunshineHoursPerYear ?? 0,
      avg_pitch: avgPitch,
      segments,
    };
  });

/** Claude Vision analysis of a satellite image at given coordinates. */
export const analyzeRoofWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lat: z.number(),
        lng: z.number(),
        address: z.string().min(1).max(500),
        pinCount: z.number().int().min(0).max(20).default(1),
        leadId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!mapsKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const zoom = data.pinCount >= 3 ? 19 : 20;
    const imgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${data.lat},${data.lng}&zoom=${zoom}&size=600x400&maptype=satellite&key=${mapsKey}`;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) {
      throw new Error(`Static Maps fetch failed: ${imgRes.status}`);
    }
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);

    const prompt = `You are a commercial roofing expert. Analyze this satellite image of a commercial roof at ${data.address}. ${data.pinCount} specific roof sections have been marked for analysis. Provide: 1) Roof type identification, 2) Visible condition issues, 3) Estimated age range, 4) Areas of concern (ponding, membrane damage, flashing issues), 5) Recommended next steps. Be specific about what you see.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: b64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Claude error ${res.status}: ${txt.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text =
      json.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n\n") ?? "";

    let savedObservations: string[] = [];
    let savedAt: string | null = null;

    if (data.leadId) {
      const { data: existing, error: existingError } = await context.supabase
        .from("leads")
        .select("ai_report")
        .eq("id", data.leadId)
        .maybeSingle();
      if (existingError) throw new Error(`Could not read existing report: ${existingError.message}`);
      if (!existing) throw new Error("Could not find this lead for report updates.");

      const prev = (existing?.ai_report as Record<string, unknown> | null) ?? {};
      const observations = extractRoofObservations(text);
      const generatedAt = new Date().toISOString();
      const nextReport = {
        ...prev,
        analysis: text,
        roof_observations: observations,
        analysis_generated_at: generatedAt,
        lat: data.lat,
        lng: data.lng,
      };
      const { data: updated, error: updateError } = await context.supabase
        .from("leads")
        .update({
          ai_report: nextReport,
        })
        .eq("id", data.leadId)
        .select("ai_report")
        .maybeSingle();
      if (updateError) throw new Error(`Could not save roof observations: ${updateError.message}`);
      if (!updated) throw new Error("Roof observations were generated but the lead was not updated.");
      savedObservations = observations;
      savedAt = generatedAt;

      const { error: activityError } = await context.supabase.from("lead_activities").insert({
        lead_id: data.leadId,
        user_id: context.userId,
        type: "ai_analysis",
        note: "AI roof analysis generated",
      });
      if (activityError) console.error("Could not record AI analysis activity", activityError.message);
    }

    return {
      analysis: text,
      roof_observations: savedObservations,
      analysis_generated_at: savedAt,
      image_url: `data:image/png;base64,${b64}`,
    };
  });
