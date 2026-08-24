import { createClient } from "@supabase/supabase-js";
import {
  EMPTY_SITE_CONTENT,
  mediaKeyOf,
  type SiteContent,
  type SiteJson,
} from "./site-content.types";

const BUCKET = "marketing";
const TTL_MS = 60_000;

let cache: { at: number; data: SiteContent } | null = null;

function publicClient() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Already-hosted static assets keep their path; bucket objects get a signed URL. */
async function resolveUrl(
  sb: ReturnType<typeof createClient>,
  path: string,
): Promise<string> {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("/")) return path;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? `/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Loads all published marketing CMS rows. Cached in-process for 60 seconds so
 * an admin edit shows up within a minute without a query per visit.
 */
export async function loadSiteContent(): Promise<SiteContent> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const sb = publicClient();
  if (!sb) return EMPTY_SITE_CONTENT;

  try {
    const [blocksRes, mediaRes, faqRes, videosRes] = await Promise.all([
      sb.from("cb_site_blocks").select("key,content,is_published").eq("is_published", true),
      sb
        .from("cb_site_media")
        .select("id,storage_path,title,caption,category,sort_order")
        .eq("is_published", true)
        .order("category")
        .order("sort_order"),
      sb
        .from("cb_site_faq")
        .select("id,question,answer,category,sort_order")
        .eq("is_published", true)
        .order("sort_order"),
      sb
        .from("cb_site_videos")
        .select("id,title,description,video_url,thumbnail_path,duration_seconds,section,sort_order")
        .eq("is_published", true)
        .order("sort_order"),
    ]);

    const blocks: Record<string, SiteJson> = {};
    for (const row of (blocksRes.data ?? []) as Array<{ key: string; content: unknown }>) {
      if (row.content && typeof row.content === "object") {
        blocks[row.key] = row.content as SiteJson;
      }
    }

    const media = await Promise.all(
      ((mediaRes.data ?? []) as Array<{
        id: string;
        storage_path: string;
        title: string;
        caption: string | null;
        category: string;
        sort_order: number;
      }>).map(async (m) => ({
        id: m.id,
        key: mediaKeyOf(m.storage_path),
        url: await resolveUrl(sb, m.storage_path),
        title: m.title,
        caption: m.caption,
        category: m.category,
        sort_order: m.sort_order,
      })),
    );

    const videos = await Promise.all(
      ((videosRes.data ?? []) as Array<{
        id: string;
        title: string;
        description: string | null;
        video_url: string | null;
        thumbnail_path: string | null;
        duration_seconds: number | null;
        section: string;
      }>).map(async (v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        video_url: v.video_url,
        thumbnail_url: v.thumbnail_path ? await resolveUrl(sb, v.thumbnail_path) : null,
        duration_seconds: v.duration_seconds,
        section: v.section,
      })),
    );

    const data: SiteContent = {
      blocks,
      media,
      faq: ((faqRes.data ?? []) as SiteContent["faq"]).map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: f.category ?? null,
      })),
      videos,
    };

    cache = { at: Date.now(), data };
    return data;
  } catch {
    // Never break the page because the CMS is unreachable — fall back to hardcoded copy.
    return cache?.data ?? EMPTY_SITE_CONTENT;
  }
}
