import { createServerFn } from "@tanstack/react-start";
import type { SiteContent } from "./site-content.types";

/** Public, unauthenticated read of the marketing CMS. Cached 60s server-side. */
export const getSiteContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteContent> => {
    const { loadSiteContent } = await import("./site-content.server");
    return loadSiteContent();
  },
);
