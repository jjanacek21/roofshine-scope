import { createFileRoute } from "@tanstack/react-router";
import { JobDocumentsPanel } from "@/components/jobs/JobDocumentsPanel";

export const Route = createFileRoute("/_app/jobs/$id/documents")({
  component: JobDocumentsRoute,
});

function JobDocumentsRoute() {
  const { id } = Route.useParams();
  return <JobDocumentsPanel jobId={id} />;
}
