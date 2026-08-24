import { createFileRoute } from "@tanstack/react-router";
import ResourcesPage from "@/pages/marketing/Resources";
import { getSiteContent } from "@/lib/site-content.functions";
import { EMPTY_SITE_CONTENT } from "@/lib/site-content.types";

const title = "Resources — the Blue Collar Sales Survival Guide";
const description =
  "The Blue Collar Sales Survival Guide, the New Rep 7-Day Ramp and short field videos for roofing sales reps.";

export const Route = createFileRoute("/resources")({
  loader: async () => {
    try {
      return await getSiteContent();
    } catch {
      return EMPTY_SITE_CONTENT;
    }
  },
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
  component: ResourcesRoute,
  errorComponent: () => <ResourcesPage />,
  notFoundComponent: () => <ResourcesPage />,
});

function ResourcesRoute() {
  const content = Route.useLoaderData();
  return <ResourcesPage content={content} />;
}
