import MarketingRefView from "./ref/MarketingRefView";
import { useSiteContent } from "@/lib/useSiteContent";

export default function BlogPage() {
  return <MarketingRefView view="blog" content={useSiteContent()} />;
}
