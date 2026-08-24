import { createFileRoute } from "@tanstack/react-router";
import FaqPage from "@/pages/marketing/Faq";
import { getSiteContent } from "@/lib/site-content.functions";
import { faqJsonLd } from "@/components/marketing/FaqAccordion";
import { EMPTY_SITE_CONTENT } from "@/lib/site-content.types";

const title = "FAQ — Claim Buddy roof measurement and inspection app";
const description =
  "Answers about Claim Buddy: roof measurement accuracy, carrier-style estimates, pricing per seat, offline use and getting a team started.";

export const Route = createFileRoute("/faq")({
  loader: async () => {
    try {
      return await getSiteContent();
    } catch {
      return EMPTY_SITE_CONTENT;
    }
  },
  head: ({ loaderData }) => {
    const jsonLd = faqJsonLd(loaderData?.faq ?? []);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: jsonLd ? [{ type: "application/ld+json", children: jsonLd }] : [],
    };
  },
  component: FaqRoute,
  errorComponent: () => <FaqPage />,
  notFoundComponent: () => <FaqPage />,
});

function FaqRoute() {
  const content = Route.useLoaderData();
  return <FaqPage content={content} />;
}
