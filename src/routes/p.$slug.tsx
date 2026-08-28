import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SITE_DEFAULTS } from "@/lib/site/defaults";

export const Route = createFileRoute("/p/$slug")({
  component: PublicPage,
});

/**
 * Public marketing pages, served from the CMS.
 *
 * The pages are complete self-contained documents — their own styles, their
 * own scripts, their own interactive demos — so they render inside an iframe
 * rather than being injected into this app's DOM. That keeps their CSS from
 * colliding with the app shell, lets their scripts actually run, and means a
 * bad paste in the editor can only break the frame, never the admin panel.
 *
 * If the row is missing or empty, the version that shipped with the build is
 * used, so the URL is never a blank screen.
 */
function PublicPage() {
  const { slug } = Route.useParams();
  const [html, setHtml] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("site_pages")
        .select("html, published")
        .eq("slug", slug)
        .maybeSingle();
      if (!alive) return;
      const row = data as { html: string; published: boolean } | null;
      // RLS already hides unpublished pages from everyone but a super admin,
      // so anything that comes back here is safe to render.
      const body = row?.html?.trim() ? row.html : (SITE_DEFAULTS[slug] ?? "");
      if (!body) {
        setMissing(true);
        return;
      }
      setHtml(body);
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (missing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-8 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">There is no published page at this address.</p>
      </div>
    );
  }

  if (html === null) {
    return <div className="min-h-screen" style={{ background: "#05070e" }} />;
  }

  return (
    <iframe
      title="Global Contractor Network"
      srcDoc={html}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
        background: "#05070e",
      }}
    />
  );
}
