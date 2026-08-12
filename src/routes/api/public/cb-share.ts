import { createFileRoute } from "@tanstack/react-router";

/**
 * Public asset proxy for a shared damage report.
 *
 * cb-photos and cb-documents are private buckets, so a share-link visitor has
 * no way to sign a URL. This endpoint verifies the share token server-side,
 * checks the requested path really belongs to that report's job, and only then
 * redirects to a short-lived signed URL.
 */
export const Route = createFileRoute("/api/public/cb-share")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const path = url.searchParams.get("path") ?? "";
        const bucket = url.searchParams.get("bucket") === "documents" ? "cb-documents" : "cb-photos";
        if (!/^[a-f0-9]{32,96}$/i.test(token) || !path || path.includes("..")) {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: report } = await supabaseAdmin
          .from("cb_reports")
          .select("job_id, pdf_path, share_expires_at")
          .eq("share_token", token)
          .maybeSingle();
        if (!report || !report.share_expires_at || new Date(report.share_expires_at) < new Date()) {
          return new Response("Link expired", { status: 404 });
        }

        if (bucket === "cb-documents") {
          if (path !== report.pdf_path) return new Response("Not found", { status: 404 });
        } else {
          const { data: photo } = await supabaseAdmin
            .from("cb_photos")
            .select("id")
            .eq("job_id", report.job_id)
            .or(`storage_path.eq.${path},thumb_path.eq.${path}`)
            .maybeSingle();
          if (!photo) return new Response("Not found", { status: 404 });
        }

        const { data: signed } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 600);
        if (!signed?.signedUrl) return new Response("Not found", { status: 404 });

        return new Response(null, {
          status: 302,
          headers: { location: signed.signedUrl, "cache-control": "private, max-age=300" },
        });
      },
    },
  },
});
