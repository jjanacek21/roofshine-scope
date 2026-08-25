import { createFileRoute } from "@tanstack/react-router";
import PricingPage from "@/pages/marketing/Pricing";

const title = "Claim Buddy pricing — Basic, Pro and Elite plans";
const description =
  "Basic $19.99 per user per month. Pro $120/mo with 3 seats and AI measurements, $30 per extra seat. Elite $200/mo with 3 seats, Storm Intel and your market price book, $40 per extra seat.";

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
