import MarketingRefView from "./ref/MarketingRefView";
import { useSiteContent } from "@/lib/useSiteContent";
import type { SiteContent } from "@/lib/site-content.types";

/**
 * gcn.claims home. `content` is passed directly by the root component (which
 * renders this before the router outlet for the standalone surface); every
 * other marketing route reads the same content from context.
 */
export default function Landing({ content }: { content?: SiteContent }) {
  const ctx = useSiteContent();
  return <MarketingRefView view="home" content={content ?? ctx} />;
}
