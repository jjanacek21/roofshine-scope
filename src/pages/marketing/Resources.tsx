import MarketingRefView from "./ref/MarketingRefView";
import { useSiteContent } from "@/lib/useSiteContent";

export default function ResourcesPage() {
  return <MarketingRefView view="resources" content={useSiteContent()} />;
}
