import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin-only endpoint: ingest a Roofr / EagleView / Hover PDF report,
 * extract ground-truth measurements via Lovable AI (Gemini 2.5 Pro),
 * geocode the address, fetch Google Solar's response for the same point,
 * and store both side-by-side in `training_examples`.
 */

interface GroundTruth {
  total_sqft?: number;
  predominant_pitch?: string;
  eaves_lf?: number;
  rakes_lf?: number;
  ridges_lf?: number;
  hips_lf?: number;
  valleys_lf?: number;
  facets?: Array<{ name?: string; area_sqft?: number; pitch?: string }>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function extractGroundTruth(pdfBuffer: ArrayBuffer, source: string): Promise<GroundTruth> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const b64 = arrayBufferToBase64(pdfBuffer);

  const systemPrompt =
    `You are an expert at parsing roof measurement reports from ${source} (Roofr, EagleView, Hover, etc). ` +
    "Extract the verified ground-truth measurements from the report. " +
    "Return total roof area in square feet (NOT squares), predominant pitch in 'X/12' notation, " +
    "and lengths in linear feet for eaves, rakes, ridges, hips, and valleys. " +
    "If a per-facet table is shown, extract each facet's name, area in sqft, and pitch.";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract ground-truth roof measurements from this report PDF." },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_ground_truth",
            description: "Return the verified roof measurements from the report.",
            parameters: {
              type: "object",
              properties: {
                total_sqft: { type: "number" },
                predominant_pitch: { type: "string" },
                eaves_lf: { type: "number" },
                rakes_lf: { type: "number" },
                ridges_lf: { type: "number" },
                hips_lf: { type: "number" },
                valleys_lf: { type: "number" },
                facets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      area_sqft: { type: "number" },
                      pitch: { type: "string" },
                    },
                    additionalProperties: false,
                  },
                },
              },
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_ground_truth" } },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) throw new Error("AI rate limit exceeded — try again in a minute.");
    if (response.status === 402) throw new Error("AI credits exhausted — top up in Settings → Workspace → Usage.");
    throw new Error(`AI gateway error ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("AI returned no structured measurements.");
  return JSON.parse(toolCall.function.arguments) as GroundTruth;
}

async function geocode(address: string, key: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = (await r.json()) as { results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }> };
  const loc = j.results?.[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

async function fetchSolar(lat: number, lng: number, key: string): Promise<unknown> {
  const url =
    `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
    `?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${key}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return await r.json();
}

export const Route = createFileRoute("/api/train-from-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const token = authHeader.replace("Bearer ", "");

          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SERVICE_ROLE) {
            return Response.json({ error: "Server misconfigured" }, { status: 500 });
          }

          // Verify caller is super_admin
          const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
          if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
          const userId = claims.claims.sub;

          const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
          if (profile?.role !== "super_admin") {
            return new Response("Forbidden — super_admin only", { status: 403 });
          }

          const form = await request.formData();
          const file = form.get("file");
          const address = String(form.get("address") ?? "").trim();
          const source = String(form.get("source") ?? "manual").trim().toLowerCase();
          const notes = String(form.get("notes") ?? "").trim() || null;
          const aiRunId = String(form.get("ai_run_id") ?? "").trim() || null;

          if (!(file instanceof File)) return Response.json({ error: "Missing PDF file" }, { status: 400 });
          if (!address) return Response.json({ error: "Address required" }, { status: 400 });
          if (file.size > 25 * 1024 * 1024) return Response.json({ error: "PDF exceeds 25 MB" }, { status: 413 });

          const buf = await file.arrayBuffer();

          // 1. Extract ground truth via AI
          const groundTruth = await extractGroundTruth(buf, source);

          // 2. Geocode (best-effort)
          let coords: { lat: number; lng: number } | null = null;
          let solarResponse: unknown = null;
          if (GOOGLE_KEY) {
            coords = await geocode(address, GOOGLE_KEY);
            if (coords) solarResponse = await fetchSolar(coords.lat, coords.lng, GOOGLE_KEY);
          }

          // 3. Upload PDF to roof-reports bucket under a training/ prefix
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `training/${userId}/${Date.now()}_${safeName}`;
          const { error: upErr } = await admin.storage
            .from("roof-reports")
            .upload(storagePath, buf, { contentType: "application/pdf", upsert: false });
          if (upErr) console.error("training PDF upload error:", upErr);

          // 4. Insert training_examples row
          const { data: row, error: insErr } = await admin
            .from("training_examples")
            .insert({
              address,
              lat: coords?.lat ?? null,
              lng: coords?.lng ?? null,
              ground_truth: groundTruth as unknown as Record<string, unknown>,
              solar_response: (solarResponse ?? {}) as Record<string, unknown>,
              source,
              pdf_storage_path: upErr ? null : storagePath,
              notes,
              created_by: userId,
            })
            .select("id")
            .single();
          if (insErr) {
            return Response.json({ error: insErr.message }, { status: 500 });
          }

          return Response.json({
            id: row.id,
            ground_truth: groundTruth,
            geocoded: coords,
            solar_available: !!solarResponse,
          });
        } catch (e) {
          console.error("train-from-pdf error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Failed to ingest training PDF" },
            { status: 500 },
          );
        }
      },
    },
  },
});
