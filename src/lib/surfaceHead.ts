/**
 * Per-surface document head.
 *
 * The same worker serves both gcn.claims (Claim Buddy) and globalcontractor.app
 * (GlobalContractor), so the head tags are resolved per request from the Host
 * header during SSR, and from the hostname on client navigations.
 */
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { isStandaloneHost, type CbSurface } from "@/lib/cbMode";

export const getRequestHostname = createIsomorphicFn()
  .server(() => (getRequestHeader("host") ?? "").split(":")[0])
  .client(() => window.location.hostname);

export function resolveSurfaceFromHost(hostname: string): CbSurface {
  return isStandaloneHost(hostname) ? "standalone" : "platform";
}

export interface SurfaceHead {
  title: string;
  description: string;
  url: string;
  image: string;
  themeColor: string;
  appTitle: string;
}

export const PLATFORM_HEAD: SurfaceHead = {
  title: "GCN App — Multi-Trade Estimating for Contractors",
  description:
    "Global Contractor App manages leads, generates roof reports, and facilitates property analysis.",
  url: "https://globalcontractor.app",
  image:
    "https://storage.googleapis.com/gpt-engineer-file-uploads/g4If15kXRDOjVQ3KUjFeHCxuPqy2/social-images/social-1778006021379-Image_4-28-26_at_1.11_PM.webp",
  themeColor: "#0b0f14",
  appTitle: "GCN App",
};

export const STANDALONE_HEAD: SurfaceHead = {
  title: "Claim Buddy — Roof inspections, damage reports and estimates",
  description:
    "Walk the roof, document the damage, generate the report and close the job — all from your phone.",
  url: "https://gcn.claims",
  image:
    "https://storage.googleapis.com/gpt-engineer-file-uploads/g4If15kXRDOjVQ3KUjFeHCxuPqy2/social-images/social-1778006021379-Image_4-28-26_at_1.11_PM.webp",
  themeColor: "#0b0f14",
  appTitle: "Claim Buddy",
};

export function headForSurface(surface: CbSurface): SurfaceHead {
  return surface === "standalone" ? STANDALONE_HEAD : PLATFORM_HEAD;
}

export function surfaceMeta(surface: CbSurface) {
  const h = headForSurface(surface);
  return [
    { title: h.title },
    { name: "description", content: h.description },
    { property: "og:title", content: h.title },
    { name: "twitter:title", content: h.title },
    { property: "og:description", content: h.description },
    { name: "twitter:description", content: h.description },
    { property: "og:url", content: h.url },
    { property: "og:image", content: h.image },
    { name: "twitter:image", content: h.image },
    { name: "twitter:card", content: "summary_large_image" },
    { property: "og:type", content: "website" },
    { name: "theme-color", content: h.themeColor },
    { name: "apple-mobile-web-app-title", content: h.appTitle },
    { name: "application-name", content: h.appTitle },
  ];
}
