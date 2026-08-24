import { createFileRoute } from "@tanstack/react-router";
import ProductPage from "@/pages/marketing/Product";

const title = "The Claim Buddy app — every screen a rep touches";
const description =
  "Measure, take off, document, estimate, present and get signed — a screen-by-screen tour of the Claim Buddy roof inspection app.";

export const Route = createFileRoute("/product")({
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
  component: ProductPage,
});
