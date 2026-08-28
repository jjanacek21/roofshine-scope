import { createFileRoute } from "@tanstack/react-router";
import { SitePage } from "@/components/site/SitePage";

export const Route = createFileRoute("/p/$slug")({
  component: PublicPage,
});

/** Public marketing pages, served from the Home Page CMS. */
function PublicPage() {
  const { slug } = Route.useParams();
  return <SitePage slug={slug} />;
}
