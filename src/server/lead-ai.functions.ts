import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    if (data.leadId) {
      await context.supabase
        .from("leads")
        .update({
          ai_report: {
            analysis: text,
            generated_at: new Date().toISOString(),
            lat: data.lat,
            lng: data.lng,
          },
        })
        .eq("id", data.leadId);
      await context.supabase.from("lead_activities").insert({
        lead_id: data.leadId,
        user_id: context.userId,
        type: "ai_analysis",
        note: "AI roof analysis generated",
      });
    }

    return {
      analysis: text,
      image_url: `data:image/png;base64,${b64}`,
    };
  });
