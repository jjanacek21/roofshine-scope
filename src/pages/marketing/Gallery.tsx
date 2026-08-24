import MarketingRefView from "./ref/MarketingRefView";
import { useSiteContent } from "@/lib/useSiteContent";

export default function GalleryPage() {
  return <MarketingRefView view="gallery" content={useSiteContent()} />;
}
