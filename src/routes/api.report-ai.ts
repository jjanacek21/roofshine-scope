import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Action = "cover_letter" | "flyer" | "infographic" | "cover_photo";

type Body = {
  action: Action;
  job_id: string;
  prompt?: string;
  tone?: string;
  style?: string;
};

export const Route = createFileRoute("/api/report-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.replace("Bearer ", "");

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY!;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !LOVABLE_API_KEY) {
          return Response.json({ error: "Server misconfigured" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims } = await supabase.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        let body: Body;
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const { action, job_id, prompt, tone, style } = body;
        if (!action || !job_id) return Response.json({ error: "action and job_id required" }, { status: 400 });

        const { data: job } = await supabase
          .from("jobs")
          .select("id, company_id, name, job_type, property_address, primary_trade")
          .eq("id", job_id)
          .maybeSingle();
        if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

        const { data: company } = await supabase
          .from("companies")
          .select("name, phone, email, website")
          .eq("id", job.company_id)
          .maybeSingle();
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", (job as any).client_id ?? "00000000-0000-0000-0000-000000000000")
          .maybeSingle();

        const context = `Job: ${job.job_type ?? "Construction"} at ${job.property_address ?? "property"}. Company: ${company?.name ?? ""}. Client: ${client?.name ?? "Homeowner"}.`;

        // ============ TEXT GENERATION ============
        if (action === "cover_letter") {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: `You write professional, warm cover letters for contractors presenting estimates to homeowners. Tone: ${tone ?? "professional"}. Return plain text, 2-3 short paragraphs, no markdown.` },
                { role: "user", content: `${context}\n\nWrite a cover letter introducing the attached proposal. ${prompt ?? ""}` },
              ],
            }),
          });
          if (!aiRes.ok) return Response.json({ error: `AI error ${aiRes.status}` }, { status: 502 });
          const aiJson = await aiRes.json();
          const text = aiJson.choices?.[0]?.message?.content ?? "";
          return Response.json({ kind: "text", text });
        }

        // ============ IMAGE GENERATION ============
        const imagePrompt =
          action === "flyer"
            ? `Professional marketing flyer for a ${job.job_type ?? "roofing"} contractor. ${style ?? "modern, clean"} style. Include space at top for company logo. Property: ${job.property_address ?? ""}. ${prompt ?? ""}`
            : action === "infographic"
              ? `Clean professional infographic summarizing a ${job.job_type ?? "roofing"} project scope. Use icons and large numbers. ${style ?? "modern, blue accent"}. ${prompt ?? ""}`
              : `Stunning cover photo / hero image for a ${job.job_type ?? "roofing"} proposal. ${style ?? "cinematic, golden hour"}. ${prompt ?? ""}`;

        const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: imagePrompt }],
            modalities: ["image", "text"],
          }),
        });
        if (!imgRes.ok) {
          const t = await imgRes.text();
          return Response.json({ error: `Image AI error ${imgRes.status}: ${t.slice(0, 200)}` }, { status: 502 });
        }
        const imgJson = await imgRes.json();
        const dataUrl: string | undefined = imgJson.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!dataUrl?.startsWith("data:image/")) {
          return Response.json({ error: "No image returned" }, { status: 502 });
        }
        const [meta, b64] = dataUrl.split(",");
        const mime = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const ext = mime.split("/")[1] ?? "png";
        const path = `${job.company_id}/${job_id}/ai-${action}-${Date.now()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("report-assets")
          .upload(path, bytes, { contentType: mime, upsert: false });
        if (upErr) return Response.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

        const { data: asset, error: insErr } = await supabase
          .from("report_assets")
          .insert({
            company_id: job.company_id,
            job_id,
            kind: "ai_image",
            storage_path: path,
            bucket: "report-assets",
            mime_type: mime,
            file_size: bytes.byteLength,
            meta: { action, prompt: imagePrompt, style, tone },
            created_by: userId,
          })
          .select("*")
          .single();
        if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

        const { data: signed } = await supabase.storage
          .from("report-assets")
          .createSignedUrl(path, 3600);

        return Response.json({ kind: "image", asset, signed_url: signed?.signedUrl ?? null });
      },
    },
  },
});
