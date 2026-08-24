import { createFileRoute } from "@tanstack/react-router";
import PricingPage from "@/pages/marketing/Pricing";

const title = "Claim Buddy pricing — Basic, Pro and Elite plans";
const description =
  "Basic $99, Pro $149 with AI measurements and the Survival Guide, Elite $249 with Storm Intel and your market price book. Volume discounts to 25%.";

export const Route = createFileRoute("/pricing")({
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
  component: PricingPage,
});
