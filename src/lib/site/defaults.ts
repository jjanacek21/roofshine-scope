import appHome from "./app-home.html?raw";
import claimsHome from "./claims-home.html?raw";

/**
 * The marketing pages as they shipped.
 *
 * The CMS stores whatever is currently live in `site_pages`, but a brand new
 * install — or a page someone has emptied by accident — needs something to
 * fall back to. These are the built versions, imported as text at build time,
 * so "Reset to shipped" always has something real to restore.
 */
export const SITE_DEFAULTS: Record<string, string> = {
  "app-home": appHome,
  "claims-home": claimsHome,
};

export const SITE_PAGE_LABELS: Record<string, string> = {
  "app-home": "GCN App home",
  "claims-home": "Claim Buddy home",
};
