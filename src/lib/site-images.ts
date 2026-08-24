/**
 * The single image resolver for the marketing site.
 *
 * Every image on gcn.claims — screenshots, the nav mark, the hero logo, the
 * footer logo — goes through img(key, fallback). The key is looked up in the
 * cb_site_media map (normalised with mediaKeyOf on both sides, so m1_pin.webp,
 * m1-pin.jpg and "M1 Pin.PNG" all resolve to the same row) and the repo file is
 * used only when no row exists. No component renders a bare /marketing/... src.
 */

import { mediaKeyOf, type SiteContent } from "./site-content.types";

/** Screens that exist in the repo as .jpg (the generated mockups we keep as fallbacks). */
const REPO_JPG_SCREENS = new Set([
  "au_1",
  "cr_1",
  "cr_2",
  "cr_3",
  "cr_4",
  "cr_5",
  "cr_6",
  "cr_7",
  "cr_8",
  "cr_9",
  "es_1",
  "ex_1",
  "ex_2",
  "m1_pin",
  "m2_measuring",
  "m3_footprint",
  "m4_drawing",
  "m5_lines",
  "m6_label",
  "m7_labeled",
  "ph_1",
  "pr_1",
  "progress",
  "rb_1",
  "rb_cover",
  "tk_1",
  "tk_2",
  "wideshots",
]);

/** Brand images. Animated logo first — it is an animated WebP with alpha, rendered as-is. */
export const BRAND_IMAGES: Record<string, string> = {
  claimbuddy_logo_animated: "/marketing/logo/claimbuddy-logo-animated.webp",
  claimbuddy_logo: "/marketing/logo/claimbuddy-logo.png",
  claimbuddy_mark: "/marketing/logo/claimbuddy-mark.png",
};

/** True when the repo ships a fallback file for this screenshot key. */
export function hasRepoScreen(key: string): boolean {
  return REPO_JPG_SCREENS.has(key);
}

/** Repo path used when the CMS has no row for a screenshot key. */
export function screenFallback(key: string): string {
  return REPO_JPG_SCREENS.has(key)
    ? `/marketing/screens/${key}.jpg`
    : `/marketing/screens/${key}.webp`;
}

export function fallbackFor(key: string): string {
  return BRAND_IMAGES[key] ?? screenFallback(key);
}

export type ImageResolver = {
  /** CMS URL for the key, or the fallback path when there is no row. */
  img: (key: string, fallback?: string) => string;
  /** True when a cb_site_media row backs this key. */
  hasRow: (key: string) => boolean;
  /** key -> resolved URL, for every key the site asks for. */
  resolveAll: (keys: string[]) => Record<string, string>;
};

export function createImageResolver(content?: SiteContent | null): ImageResolver {
  const byKey = new Map<string, string>();
  for (const m of content?.media ?? []) {
    byKey.set(mediaKeyOf(m.key), m.url);
  }
  const img = (key: string, fallback?: string) =>
    byKey.get(mediaKeyOf(key)) ?? fallback ?? fallbackFor(key);
  return {
    img,
    hasRow: (key: string) => byKey.has(mediaKeyOf(key)),
    resolveAll: (keys: string[]) => Object.fromEntries(keys.map((k) => [k, img(k)])),
  };
}
