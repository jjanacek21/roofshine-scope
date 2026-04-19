import { createFileRoute } from "@tanstack/react-router";
import { JobPhotosPanel } from "@/components/jobs/JobPhotosPanel";

export const Route = createFileRoute("/_app/jobs/$id/photos")({
  component: JobPhotos,
});

function JobPhotos() {
  const { id } = Route.useParams();
  return <JobPhotosPanel jobId={id} />;
}
