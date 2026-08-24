import { createFileRoute } from "@tanstack/react-router";
import DemoPage from "@/pages/marketing/Demo";

const title = "Book a Claim Buddy demo — we measure your address live";
const description =
  "Book a 20-minute Claim Buddy demo. Give us an address you're working and we'll measure it live on the call — you keep the report.";

export const Route = createFileRoute("/demo")({
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
  component: DemoPage,
});
