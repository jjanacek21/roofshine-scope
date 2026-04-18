import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/jobs/$id")({
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!job) return <p className="text-sm text-muted-foreground">Job not found.</p>;

  return (
    <div className="space-y-6">
      <Link to="/jobs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to jobs
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">{job.name}</h1>
          <StatusBadge status={job.status} />
          {job.primary_trade && <TradeBadge trade={job.primary_trade} />}
        </div>
        {job.job_number && (
          <p className="mt-1 font-mono-num text-sm text-muted-foreground">{job.job_number}</p>
        )}
      </div>

      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Overview</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Property</dt>
            <dd className="mt-1 text-sm text-foreground">{job.property_address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Total Estimate</dt>
            <dd className="mt-1 font-mono-num text-sm font-semibold text-foreground">
              ${Number(job.total_estimate).toLocaleString()}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Notes</dt>
            <dd className="mt-1 text-sm text-foreground whitespace-pre-wrap">{job.notes ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <p className="text-xs text-muted-foreground">
        Measurements, Photos, Estimate, and Report tabs ship in the next build.
      </p>
    </div>
  );
}
