import { createFileRoute } from "@tanstack/react-router";
import BlogPage from "@/pages/marketing/Blog";

const title = "Claim Buddy blog — notes from the field";
const description =
  "Short, specific reads on roofing sales, storm canvassing, adjuster photos and supplements — written by reps who still knock doors.";

export const Route = createFileRoute("/blog")({
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
  component: BlogPage,
});
