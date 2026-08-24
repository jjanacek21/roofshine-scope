import { createContext, useContext } from "react";
import { EMPTY_SITE_CONTENT, type SiteContent } from "./site-content.types";

/**
 * CMS content is loaded once in the root loader (60s server cache) and shared
 * with every marketing route through context, so no page fetches its own copy.
 */
const SiteContentContext = createContext<SiteContent>(EMPTY_SITE_CONTENT);

export function SiteContentProvider({
  value,
  children,
}: {
  value: SiteContent;
  children: React.ReactNode;
}) {
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext);
}
