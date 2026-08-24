import { createFileRoute } from "@tanstack/react-router";
import PricingPage from "@/pages/marketing/Pricing";

const title = "Claim Buddy pricing — per seat, unlimited inspections";
const description =
  "Claim Buddy Core $99, Pro $149 and GCN Platform $249 per seat per month, with volume discounts up to 25% and 14 days free.";

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
