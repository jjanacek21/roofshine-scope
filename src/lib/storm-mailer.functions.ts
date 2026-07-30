import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/* ------------------------------------------------------------------ */
/* Property resolution                                                 */
/* ------------------------------------------------------------------ */

const EnsureInput = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  zip: z.string().max(20).optional(),
});

/**
 * Finds (or creates) the properties row for a canvassed house. Matching is by
 * a tight lat/lng box so repeated clicks on the same roof reuse one row.
 */
export const ensureStormProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => EnsureInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id ?? null;
    if (!companyId) return { ok: false as const, error: "No company on your profile" };

    const eps = 0.00008; // ~9 m
    const { data: existing } = await supabase
      .from("properties")
      .select("id, address, city, state, zip, roof_type, lat, lng")
      .eq("company_id", companyId)
      .gte("lat", data.lat - eps)
      .lte("lat", data.lat + eps)
      .gte("lng", data.lng - eps)
      .lte("lng", data.lng + eps)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true as const, property: existing };

    const { data: created, error } = await supabase
      .from("properties")
      .insert({
        company_id: companyId,
        address: data.address ?? `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`,
        city: data.city ?? null,
        state: data.state ?? null,
        zip: data.zip ?? null,
        lat: data.lat,
        lng: data.lng,
      })
      .select("id, address, city, state, zip, roof_type, lat, lng")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, property: created };
  });

/* ------------------------------------------------------------------ */
/* Mailer generation                                                   */
/* ------------------------------------------------------------------ */

const StormReportSchema = z
  .object({
    max_hail_in: z.number().nullable().optional(),
    max_wind_mph: z.number().nullable().optional(),
    hail_dates: z.array(z.record(z.any())).nullable().optional(),
    wind_dates: z.array(z.record(z.any())).nullable().optional(),
  })
  .passthrough();

const GenerateInput = z.object({
  property_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  address: z.string().min(1).max(300),
  lat: z.number(),
  lng: z.number(),
  roof_type: z.string().max(80).nullable().optional(),
  squares: z.number().nullable().optional(),
  storm_type: z.enum(["hail", "wind", "hurricane", "tornado"]),
  storm_report: StormReportSchema.nullable().optional(),
  tone: z.string().max(60),
  prompt_input: z.string().max(6000).optional().default(""),
  image_urls: z.array(z.string().max(600)).optional().default([]),
  signature_type: z.enum(["personal", "company"]),
  signature_payload: z.record(z.any()).optional().default({}),
  save: z.boolean().optional().default(true),
});

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(`${d}`.length <= 10 ? `${d}T12:00:00Z` : d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function stormFacts(report: any): string {
  const hail = (report?.hail_dates ?? []) as any[];
  const wind = (report?.wind_dates ?? []) as any[];
  const lines: string[] = [];
  if (report?.max_hail_in != null) lines.push(`Largest hail recorded: ${report.max_hail_in} inches.`);
  if (report?.max_wind_mph != null) lines.push(`Peak wind recorded: ${report.max_wind_mph} mph.`);
  hail.slice(0, 6).forEach((h) =>
    lines.push(`Hail on ${fmtDate(h.date)}${h.size_in != null ? ` — ${h.size_in} inch` : ""}.`),
  );
  wind.slice(0, 6).forEach((w) =>
    lines.push(`Wind on ${fmtDate(w.date)}${w.wind_mph != null ? ` — ${w.wind_mph} mph` : ""}.`),
  );
  return lines.length ? lines.join("\n") : "No specific recorded storm events for this address.";
}

export const generateStormMailer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GenerateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) return { ok: false as const, error: "AI is not configured" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = profile?.company_id;
    if (!companyId) return { ok: false as const, error: "No company on your profile" };

    const sig = data.signature_payload ?? {};
    const sigText =
      data.signature_type === "company"
        ? [sig.company_name, sig.phone, sig.license && `Lic. ${sig.license}`].filter(Boolean).join(" · ")
        : [sig.name, sig.title, sig.phone, sig.email].filter(Boolean).join(" · ");

    const system = [
      "You write direct-mail letters for a roofing contractor canvassing after severe weather.",
      "Absolute rules:",
      "1. NEVER claim or imply the recipient's roof is damaged. Nobody has inspected it.",
      "2. Only reference storms, dates, hail sizes and wind speeds supplied in the facts below. Invent nothing.",
      "3. Offer a free, no-obligation inspection as the call to action.",
      "4. Mention the roof size naturally if it is provided.",
      "5. Return clean plain text with blank-line paragraph breaks. No markdown, no bullet characters.",
      "Respond as strict JSON: {\"subject\": string, \"body\": string}.",
    ].join("\n");

    const user = [
      `Property address: ${data.address}`,
      data.roof_type ? `Roof type: ${data.roof_type}` : "",
      data.squares ? `Roof size: approximately ${data.squares.toFixed(1)} squares` : "",
      `Primary storm type: ${data.storm_type}`,
      `Tone / mood: ${data.tone}`,
      "",
      "Verified storm facts:",
      stormFacts(data.storm_report),
      "",
      data.prompt_input ? `Topic / notes from the sender:\n${data.prompt_input}` : "",
      "",
      sigText ? `Sign the letter with: ${sigText}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[generateStormMailer] AI failed [${res.status}]: ${body}`);
      if (res.status === 429) return { ok: false as const, error: "AI rate limit reached — try again shortly" };
      if (res.status === 402) return { ok: false as const, error: "AI credits exhausted" };
      return { ok: false as const, error: `AI request failed (${res.status})` };
    }

    const json = (await res.json()) as any;
    const raw = json?.choices?.[0]?.message?.content ?? "";
    let subject = "";
    let body = "";
    try {
      const parsed = JSON.parse(raw);
      subject = String(parsed.subject ?? "");
      body = String(parsed.body ?? "");
    } catch {
      subject = `Storm activity near ${data.address}`;
      body = String(raw);
    }
    if (!body.trim()) return { ok: false as const, error: "AI returned an empty letter" };

    if (!data.save) return { ok: true as const, subject, body, id: null };

    const { data: row, error } = await supabase
      .from("storm_mailers")
      .insert({
        company_id: companyId,
        campaign_id: data.campaign_id ?? null,
        property_id: data.property_id ?? null,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        roof_type: data.roof_type ?? null,
        squares: data.squares ?? null,
        storm_type: data.storm_type,
        storm_report: (data.storm_report ?? null) as any,
        tone: data.tone,
        prompt_input: data.prompt_input,
        image_urls: data.image_urls,
        generated_subject: subject,
        generated_body: body,
        signature_type: data.signature_type,
        signature_payload: data.signature_payload as any,
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };

    return { ok: true as const, subject, body, id: row.id };
  });

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

export const createMailerCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1).max(160), notes: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.company_id) return { ok: false as const, error: "No company on your profile" };
    const { data: row, error } = await supabase
      .from("storm_mailer_campaigns")
      .insert({ company_id: profile.company_id, name: data.name, notes: data.notes ?? null, created_by: userId })
      .select("id, name")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, campaign: row };
  });

/* ------------------------------------------------------------------ */
/* Owner enrichment — stub only (Phase 4 seam)                         */
/* ------------------------------------------------------------------ */

export const enrichPropertyOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ property_id: z.string().uuid() }).parse(d))
  .handler(async () => {
    // ATTOM (or similar) lands here. Intentionally not wired.
    return { ok: false as const, error: "not configured" };
  });
