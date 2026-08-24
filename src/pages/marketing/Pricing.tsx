import MarketingRefView from "./ref/MarketingRefView";
import { useSiteContent } from "@/lib/useSiteContent";

export default function PricingPage() {
  return <MarketingRefView view="pricing" content={useSiteContent()} />;
}
