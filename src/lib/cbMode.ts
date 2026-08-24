/**
 * Claim Buddy surface detection.
 *
 * One codebase, two products:
 *  - `standalone`  → gcn.claims (and any *.gcn.claims host): the app IS Claim Buddy.
 *  - `platform`    → everything else (globalcontractor.app, previews, localhost):
 *                    the normal Global Contractor app plus a /claim-buddy section.
 *
 * A `?surface=standalone` (or `?surface=platform`) query param overrides detection
 * for testing, and is remembered for the session.
 */

export type CbSurface = "platform" | "standalone";

const STORAGE_KEY = "cb_surface_override";

export function isStandaloneHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "gcn.claims" || h.endsWith(".gcn.claims");
}

export function getSurface(): CbSurface {
  if (typeof window === "undefined") return "platform";

  try {
    const param = new URLSearchParams(window.location.search).get("surface");
    if (param === "standalone" || param === "platform") {
      window.sessionStorage.setItem(STORAGE_KEY, param);
      return param;
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === "standalone" || stored === "platform") return stored;
  } catch {
    /* sessionStorage unavailable — fall through to hostname detection */
  }

  return isStandaloneHost(window.location.hostname) ? "standalone" : "platform";
}

export function isStandalone(): boolean {
  return getSurface() === "standalone";
}

/** Routes that stay reachable on the standalone surface. */
export function isClaimBuddyPath(pathname: string): boolean {
  return (
    pathname === "/cb" ||
    pathname.startsWith("/cb/") ||
    pathname.startsWith("/r/")
  );
}

/** Public marketing pages available on the standalone (gcn.claims) surface. */
const MARKETING_PATHS = new Set([
  "/product",
  "/gallery",
  "/pricing",
  "/resources",
  "/blog",
  "/demo",
  "/faq",
]);

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.has(pathname);
}
