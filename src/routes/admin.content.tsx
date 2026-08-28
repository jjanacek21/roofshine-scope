import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  FileText,
  Eye,
  Save,
  Rocket,
  RotateCcw,
  History,
  Search,
  ExternalLink,
  Loader2,
  Monitor,
  Smartphone,
} from "lucide-react";
import { SITE_DEFAULTS } from "@/lib/site/defaults";

export const Route = createFileRoute("/admin/content")({
  component: HomePageCMS,
});

type SitePage = {
  slug: string;
  name: string;
  description: string | null;
  html: string;
  draft_html: string | null;
  published: boolean;
  updated_at: string;
};

type PageVersion = {
  id: string;
  slug: string;
  label: string | null;
  created_at: string;
};

/**
 * Home Page CMS.
 *
 * The two marketing sites are single self-contained HTML documents — styles,
 * scripts and interactive demos all inline — so the honest way to make them
 * editable is to edit the document. This screen gives that a working shape:
 * a live preview beside the source, find-and-replace for the copy changes that
 * are most of the work, a draft kept separate from what the public sees, and a
 * saved version on every publish so nothing is one bad paste away from gone.
 */
function HomePageCMS() {
  const { user } = useAuth();
  const [pages, setPages] = useState<SitePage[]>([]);
  const [slug, setSlug] = useState<string>("app-home");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [versions, setVersions] = useState<PageVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [wide, setWide] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const dirtyRef = useRef(false);

  const page = useMemo(() => pages.find((p) => p.slug === slug) ?? null, [pages, slug]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_pages")
      .select("slug, name, description, html, draft_html, published, updated_at")
      .order("slug");
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as SitePage[];
    setPages(rows);
    setDraft((prev) => {
      if (prev) return prev;
      const current = rows.find((r) => r.slug === slug);
      if (!current) return SITE_DEFAULTS[slug] ?? "";
      return current.draft_html || current.html || SITE_DEFAULTS[current.slug] || "";
    });
  }, [slug]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching pages loads that page's draft, warning first if this one is dirty.
  const switchTo = (next: string) => {
    if (dirtyRef.current && !window.confirm("You have unsaved changes. Discard them?")) return;
    const p = pages.find((x) => x.slug === next);
    setSlug(next);
    setDraft(
      p ? (p.draft_html || p.html || SITE_DEFAULTS[next] || "") : (SITE_DEFAULTS[next] ?? ""),
    );
    dirtyRef.current = false;
    setShowVersions(false);
    setPreviewKey((k) => k + 1);
  };

  const edit = (v: string) => {
    setDraft(v);
    dirtyRef.current = true;
  };

  const saveDraft = async () => {
    if (!page) return;
    setBusy("save");
    const { error } = await supabase
      .from("site_pages")
      .update({
        draft_html: draft,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("slug", slug);
    setBusy(null);
    if (error) return toast.error(error.message);
    dirtyRef.current = false;
    toast.success("Draft saved. The live page is unchanged.");
    void load();
  };

  const publish = async () => {
    if (!page) return;
    if (!window.confirm(`Publish this version of ${page.name}? Visitors see it immediately.`))
      return;
    setBusy("publish");
    // Snapshot what is live now, so a bad publish is one click from undone.
    if (page.html) {
      await supabase.from("site_page_versions").insert({
        slug,
        html: page.html,
        label: "Before publish " + new Date().toLocaleString(),
        created_by: user?.id ?? null,
      });
    }
    const { error } = await supabase
      .from("site_pages")
      .update({
        html: draft,
        draft_html: null,
        published: true,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("slug", slug);
    setBusy(null);
    if (error) return toast.error(error.message);
    dirtyRef.current = false;
    toast.success("Published.");
    void load();
  };

  const unpublish = async () => {
    setBusy("publish");
    const { error } = await supabase
      .from("site_pages")
      .update({ published: false })
      .eq("slug", slug);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Taken offline. Only you can see it now.");
    void load();
  };

  const resetToShipped = () => {
    const def = SITE_DEFAULTS[slug];
    if (!def) return toast.error("No shipped version for this page.");
    if (!window.confirm("Replace the editor contents with the version that shipped with the app?"))
      return;
    edit(def);
    setPreviewKey((k) => k + 1);
    toast.success("Loaded the shipped version. Nothing is live until you publish.");
  };

  const loadVersions = async () => {
    const opening = !showVersions;
    setShowVersions(opening);
    if (!opening) return;
    const { data } = await supabase
      .from("site_page_versions")
      .select("id, slug, label, created_at")
      .eq("slug", slug)
      .order("created_at", { ascending: false })
      .limit(25);
    setVersions((data ?? []) as PageVersion[]);
  };

  const restore = async (id: string) => {
    const { data, error } = await supabase
      .from("site_page_versions")
      .select("html")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Could not load that version");
    edit((data as { html: string }).html);
    setPreviewKey((k) => k + 1);
    toast.success("Loaded into the editor. Publish it to make it live.");
  };

  const runReplace = () => {
    if (!find) return;
    const count = draft.split(find).length - 1;
    if (!count) return toast.error(`"${find}" does not appear on this page.`);
    edit(draft.split(find).join(replace));
    setPreviewKey((k) => k + 1);
    toast.success(`Replaced ${count} occurrence${count === 1 ? "" : "s"}.`);
  };

  const publicUrl = `/p/${slug}`;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pages…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Home Page CMS</h1>
          <p className="text-sm text-muted-foreground">
            Edit the public marketing pages. Drafts stay private until you publish.
          </p>
        </div>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <ExternalLink className="h-4 w-4" /> Open {publicUrl}
        </a>
      </header>

      <div className="flex flex-wrap gap-2">
        {pages.map((p) => (
          <button
            key={p.slug}
            onClick={() => switchTo(p.slug)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
              p.slug === slug
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border hover:bg-accent"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span className="font-medium">{p.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                p.published
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {p.published ? "Live" : "Offline"}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <button
          onClick={saveDraft}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          {busy === "save" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save draft
        </button>
        <button
          onClick={publish}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy === "publish" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          Publish
        </button>
        {page?.published && (
          <button
            onClick={unpublish}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            Take offline
          </button>
        )}
        <button
          onClick={resetToShipped}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <RotateCcw className="h-4 w-4" /> Reset to shipped
        </button>
        <button
          onClick={loadVersions}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <History className="h-4 w-4" /> History
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          {page ? `Updated ${new Date(page.updated_at).toLocaleString()}` : ""}
          {page?.draft_html ? " · unpublished draft saved" : ""}
        </span>
      </div>

      {showVersions && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Previous versions
          </p>
          {versions.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              No history yet. A version is saved every time you publish.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{v.label ?? "Version"}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </span>
                  <button
                    onClick={() => restore(v.id)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                  >
                    Load into editor
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
        <label className="flex min-w-[190px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Find this text</span>
          <input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="7 of 25 taken"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex min-w-[190px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Replace with</span>
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="12 of 25 taken"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={runReplace}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
        >
          <Search className="h-4 w-4" /> Replace all
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Page source
            </span>
            <span className="text-xs text-muted-foreground">
              {(draft.length / 1024).toFixed(0)} KB
            </span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => edit(e.target.value)}
            spellCheck={false}
            className="h-[560px] w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> Live preview
            </span>
            <span className="flex items-center gap-1">
              <button
                onClick={() => setWide(true)}
                className={`rounded-md p-1.5 ${wide ? "bg-accent" : ""}`}
                aria-label="Desktop preview"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setWide(false)}
                className={`rounded-md p-1.5 ${!wide ? "bg-accent" : ""}`}
                aria-label="Phone preview"
              >
                <Smartphone className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPreviewKey((k) => k + 1)}
                className="ml-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                Refresh
              </button>
            </span>
          </div>
          <div className="h-[560px] overflow-hidden rounded-xl border border-border bg-black">
            <iframe
              key={previewKey}
              title="Page preview"
              srcDoc={draft}
              sandbox="allow-scripts allow-same-origin"
              className="border-0 bg-black"
              style={
                wide
                  ? {
                      width: "1400px",
                      height: "1400px",
                      transform: "scale(0.4)",
                      transformOrigin: "0 0",
                    }
                  : {
                      width: "390px",
                      height: "1400px",
                      transform: "scale(0.4)",
                      transformOrigin: "0 0",
                    }
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Preview is scaled to 40%. Open the public URL for a true-size look.
          </p>
        </div>
      </div>
    </div>
  );
}
