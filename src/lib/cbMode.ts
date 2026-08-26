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

/**
 * Routes that stay reachable on the standalone surface.
 *
 * Anything NOT listed here is redirected to /cb with its query string thrown
 * away — which is how invite links died: `/accept-invite?token=…` fell outside
 * this list, so gcn.claims dropped the token, sent the invitee to /cb, and /cb
 * sent a signed-out visitor into the paid signup funnel. A comped customer was
 * shown a $120/mo plan picker instead of a password field.
 *
 * Any new path that an outside link can point at MUST be added here.
 */
export function isClaimBuddyPath(pathname: string): boolean {
  return (
    pathname === "/cb" ||
    pathname.startsWith("/cb/") ||
    pathname.startsWith("/r/") ||
    pathname === "/accept-invite"
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
