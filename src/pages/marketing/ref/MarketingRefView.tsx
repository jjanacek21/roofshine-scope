/**
 * The gcn.claims marketing site — a faithful mount of the approved reference
 * design. Markup and behaviour come from refMarkup/refRuntime; images come from
 * the CMS through the shared resolver, with the repo files as fallback.
 *
 * All views live in the DOM at once (as in the reference) and the active one is
 * toggled. Each real route mounts this component with its own `view`, so URLs,
 * head tags and SSR markup stay per-route while in-page nav stays instant.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { REF_VIEWS, REF_HEADER, REF_FOOTER } from "./refMarkup";
import { mountMarketingRef } from "./refRuntime";
import { SHOTS_DEFAULT } from "./refData";
import { createImageResolver, BRAND_IMAGES, hasRepoScreen } from "@/lib/site-images";
import { mediaKeyOf } from "@/lib/site-content.types";
import { makeTextRewriter } from "./refCms";
import type { SiteContent } from "@/lib/site-content.types";
import "./marketing-ref.css";

/** Prototype views that the production app owns for real. */
const REDIRECTS: Record<string, string> = {
  signup: "/demo",
  signin: "/cb/login",
  checkout: "/demo",
  done: "/demo",
  admin: "/demo",
  faq: "/faq",
};

/** Route path for each in-page view, so the URL follows in-page navigation. */
export const VIEW_PATHS: Record<string, string> = {
  home: "/",
  product: "/product",
  gallery: "/gallery",
  pricing: "/pricing",
  resources: "/resources",
  blog: "/blog",
};

/** Friendly labels for the known category slugs; unknown ones get title-cased. */
const CAT_LABELS: Record<string, string> = {
  meas: "Measurement",
  prog: "Review & progress",
  roof: "Roof takeoff",
  photos: "Photos",
  rep: "Report",
  est: "Estimate",
  carrier: "Carrier report",
  pres: "Presentation",
  auth: "Agreement",
};

const titleCase = (s: string) =>
  s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const VIEW_ORDER = ["home", "product", "gallery", "pricing", "resources", "blog"];

/** The active view is server-rendered with .on so crawlers and no-JS visitors see it. */
function shellHtml(active: string, rewrite: (h: string) => string): string {
  const views = VIEW_ORDER.map(
    (k) =>
      `<section class="view${k === active ? " on" : ""}" id="v-${k}">${REF_VIEWS[k] ?? ""}</section>`,
  ).join("");
  return rewrite(`${REF_HEADER}<main id="mkt-main">${views}</main>${REF_FOOTER}`);
}

export default function MarketingRefView({
  view,
  content,
}: {
  view: string;
  content?: SiteContent;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Frozen at first render: React must never re-write this subtree, because the
  // runtime owns its DOM after mount. View switches go through goRef instead.
  const htmlRef = useRef<string | null>(null);
  const rewrite = makeTextRewriter(content);
  if (htmlRef.current === null) htmlRef.current = shellHtml(view, rewrite);
  const goRef = useRef<((v: string, notify?: boolean) => void) | null>(null);
  const navigate = useNavigate();

  // Keep the latest navigate/content in refs so the runtime mounts only once.
  const navRef = useRef(navigate);
  navRef.current = navigate;
  const viewRef = useRef(view);
  viewRef.current = view;
  const textRef = useRef(rewrite);
  textRef.current = rewrite;
  const catsRef = useRef<string[][]>([]);
  const catByKeyRef = useRef<Record<string, string>>({});

  // Only keys that actually resolve to an image are handed to the runtime; a key
  // with neither a CMS row nor a repo file is dropped rather than rendered broken.
  const shots = (() => {
    const resolver = createImageResolver(content);
    const out: Record<string, string> = {};
    for (const key of Object.keys(SHOTS_DEFAULT)) {
      if (resolver.hasRow(key) || hasRepoScreen(key)) out[key] = resolver.img(key);
    }
    return out;
  })();

  const brand = (() => {
    const resolver = createImageResolver(content);
    return {
      animated: resolver.img("claimbuddy_logo_animated", BRAND_IMAGES.claimbuddy_logo_animated),
      still: resolver.img("claimbuddy_logo", BRAND_IMAGES.claimbuddy_logo),
      mark: resolver.img("claimbuddy_mark", BRAND_IMAGES.claimbuddy_mark),
    };
  })();

  // Gallery filter chips come from the categories actually present in
  // cb_site_media, so unpublishing the last photo of a category retires its
  // chip. Falls back to the built-in list when the CMS has no media rows.
  const { cats, catByKey } = (() => {
    const catByKey: Record<string, string> = {};
    const seen: string[] = [];
    for (const m of content?.media ?? []) {
      const c = (m.category ?? "").trim();
      if (!c) continue;
      catByKey[mediaKeyOf(m.key)] = c; // normalized key, never array position
      if (!seen.includes(c)) seen.push(c);
    }
    const cats = seen.length
      ? [["all", "All"], ...seen.map((c) => [c, CAT_LABELS[c] ?? titleCase(c)])]
      : [];
    return { cats, catByKey };
  })();

  catsRef.current = cats;
  catByKeyRef.current = catByKey;

  const shotsKey = JSON.stringify(shots) + JSON.stringify(brand) + JSON.stringify(cats);

  useEffect(() => {
    const root = hostRef.current;
    if (!root) return;
    let cleanup: (() => void) | null = null;
    let remounts = 0;

    const mount = () => {
      root.innerHTML = htmlRef.current ?? "";
      cleanup = mountMarketingRef(root, {
        shots,
        brand,
        initialView: viewRef.current,
        text: textRef.current,
        cats: catsRef.current,
        catByKey: catByKeyRef.current,
        redirects: REDIRECTS,
        onExternal: (url) => {
          void navRef.current({ to: url });
        },
        onView: (v) => {
          const path = VIEW_PATHS[v];
          if (path) window.history.pushState({}, "", path);
        },
        exposeGo: (go) => {
          goRef.current = go;
        },
      });
      const marker = document.createElement("span");
      marker.setAttribute("data-mkt-mounted", "");
      marker.hidden = true;
      root.appendChild(marker);
    };

    mount();

    // React rewrites this subtree's innerHTML on its first update after
    // hydration, which throws away everything the runtime wired up. When the
    // marker disappears, rebuild and re-wire instead of leaving a dead shell.
    const obs = new MutationObserver(() => {
      if (root.querySelector("[data-mkt-mounted]") || remounts >= 5) return;
      remounts += 1;
      cleanup?.();
      mount();
    });
    obs.observe(root, { childList: true });

    return () => {
      obs.disconnect();
      goRef.current = null;
      cleanup?.();
    };
    // Remount only when the resolved imagery changes, never on view switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shotsKey]);

  // Route change (back/forward, header links) drives the in-page view.
  useEffect(() => {
    goRef.current?.(view, false);
  }, [view]);

  return (
    <div
      className="mkt-ref"
      ref={hostRef}
      dangerouslySetInnerHTML={{ __html: htmlRef.current }}
      suppressHydrationWarning
    />
  );
}
