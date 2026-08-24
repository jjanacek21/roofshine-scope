import { createFileRoute } from "@tanstack/react-router";
import GalleryPage from "@/pages/marketing/Gallery";

const title = "Claim Buddy screenshot gallery";
const description =
  "Browse every Claim Buddy screen — measurement, roof takeoff, photos, estimates, reports, presentation and carrier-style PDFs.";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GalleryPage,
});
