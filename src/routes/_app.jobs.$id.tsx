import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobHeader, type JobHeaderJob } from "@/components/jobs/JobHeader";
import { JobTabs } from "@/components/jobs/JobTabs";

export const Route = createFileRoute("/_app/jobs/$id")({
  component: JobLayout,
});

function JobLayout() {
  const { id } = Route.useParams();

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["job-client", job?.client_id],
    enabled: !!job?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("id", job!.client_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: priceBook } = useQuery({
    queryKey: ["job-pricebook", job?.price_book_id],
    enabled: !!job?.price_book_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name")
        .eq("id", job!.price_book_id!)
        .maybeSingle();
      return data;
    },
  });

  // First photo for thumbnail
  const { data: firstPhotoPath } = useQuery({
    queryKey: ["job-first-photo", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_photos")
        .select("storage_path")
        .eq("job_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data?.storage_path ?? null;
    },
  });

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!firstPhotoPath) {
      setThumbnailUrl(null);
      return;
    }
    supabase.storage
      .from("roof-photos")
      .createSignedUrl(firstPhotoPath, 3600)
      .then(({ data }) => setThumbnailUrl(data?.signedUrl ?? null));
  }, [firstPhotoPath]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-[var(--bg-card)]" />
        <div className="h-24 animate-pulse rounded-xl bg-[var(--bg-card)]" />
        <div className="h-10 animate-pulse rounded bg-[var(--bg-card)]" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to jobs
        </Link>
        <p className="text-sm text-muted-foreground">Job not found.</p>
      </div>
    );
  }

  const headerJob: JobHeaderJob = {
    id: job.id,
    name: job.name,
    job_number: job.job_number,
    status: job.status,
    primary_trade: job.primary_trade,
    property_address: job.property_address,
    price_book_id: job.price_book_id,
  };

  return (
    <div className="space-y-6">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to jobs
      </Link>

      <JobHeader
        job={headerJob}
        clientName={client?.name}
        priceBookName={priceBook?.name}
        thumbnailUrl={thumbnailUrl}
      />

      <JobTabs jobId={job.id} />

      <Outlet />
    </div>
  );
}
