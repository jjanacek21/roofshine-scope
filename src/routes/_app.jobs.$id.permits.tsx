import { createFileRoute } from "@tanstack/react-router";
import { JobPermitPanel } from "@/components/permits/JobPermitPanel";

export const Route = createFileRoute("/_app/jobs/$id/permits")({
  component: JobPermitsRoute,
});

function JobPermitsRoute() {
  const { id } = Route.useParams();
  return <JobPermitPanel jobId={id} />;
}
