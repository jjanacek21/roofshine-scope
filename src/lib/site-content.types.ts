/** Shared shapes for CMS-backed marketing content (client-safe, no server imports). */

export type SiteJsonValue =
  | string
  | number
  | boolean
  | null
  | SiteJsonValue[]
  | { [k: string]: SiteJsonValue };

export type SiteJson = Record<string, SiteJsonValue>;

export type SiteMediaItem = {
  id: string;
  key: string; // stable key: filename stem of storage_path
  url: string;
  title: string;
  caption: string | null;
  category: string;
  sort_order: number;
};

export type SiteFaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
};

export type SiteVideoItem = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  section: string;
};

export type SiteContent = {
  blocks: Record<string, SiteJson>;
  media: SiteMediaItem[];
  faq: SiteFaqItem[];
  videos: SiteVideoItem[];
};

export const EMPTY_SITE_CONTENT: SiteContent = {
  blocks: {},
  media: [],
  faq: [],
  videos: [],
};

/* ------------------------------------------------------------------ */
/* Fallback-safe readers — a missing row or key renders the hardcoded  */
/* value instead of an empty heading.                                  */
/* ------------------------------------------------------------------ */

export function blockOf(content: SiteContent | undefined, key: string): SiteJson {
  const b = content?.blocks?.[key];
  return b && typeof b === "object" ? b : {};
}

export function str(block: SiteJson, key: string, fallback: string): string {
  const v = block[key];
  return typeof v === "string" && v.trim() ? v : fallback;
}

export function arr<T>(block: SiteJson, key: string, fallback: T[]): T[] {
  const v = block[key];
  return Array.isArray(v) && v.length ? (v as unknown as T[]) : fallback;
}

export function obj(block: SiteJson, key: string, fallback: SiteJson): SiteJson {
  const v = block[key];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as SiteJson) : fallback;
}

/**
 * Stable media key: filename stem, minus any upload timestamp prefix, with
 * separators normalized. "media/1787598389713-m1-pin.jpg" and
 * "/marketing/steps/m1_pin.jpg" both resolve to "m1pin", so an uploaded
 * replacement matches the hardcoded frame it stands in for.
 */
export function mediaKeyOf(path: string): string {
  const base = (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
  return base
    .replace(/^\d{10,}[-_]?/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
