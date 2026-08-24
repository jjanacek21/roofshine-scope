import MarketingRefView from "./ref/MarketingRefView";
import { useSiteContent } from "@/lib/useSiteContent";

export default function ProductPage() {
  return <MarketingRefView view="product" content={useSiteContent()} />;
}
