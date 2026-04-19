import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoofMeasurementPanel } from "@/components/roof/RoofMeasurementPanel";

export const Route = createFileRoute("/_app/jobs/$id/measure")({
  component: JobMeasure,
});

function JobMeasure() {
  const { id } = Route.useParams();

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: property } = useQuery({
    queryKey: ["job-property", job?.property_id],
    enabled: !!job?.property_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("*")
        .eq("id", job!.property_id!)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-xl bg-[var(--bg-card)]" />;
  }

  if (!job?.property_id) {
    return (
      <div
        className="rounded-xl border p-12 text-center text-sm text-muted-foreground"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        This job has no linked property yet. Add a property first to take measurements.
      </div>
    );
  }

  const center =
    property?.lat != null && property?.lng != null
      ? { lat: Number(property.lat), lng: Number(property.lng) }
      : null;

  return <RoofMeasurementPanel propertyId={job.property_id} center={center} />;
}
