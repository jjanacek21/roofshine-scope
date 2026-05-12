import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { JOB_STATUSES, type JobStatus } from "@/lib/trades";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProfile, useIsCompanyAdmin } from "@/hooks/useProfile";
import { useCompanyMembers, memberName, type CompanyMember } from "@/hooks/useCompanyMembers";

export const Route = createFileRoute("/_app/jobs/")({
  component: JobsKanban,
});

interface Job {
  id: string;
  name: string;
  job_number: string | null;
  status: JobStatus;
  primary_trade: string | null;
  total_estimate: number;
  property_address: string | null;
  client_id: string | null;
  created_by: string | null;
  assigned_to: string | null;
}

function JobsKanban() {
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { data: profile } = useProfile();
  const isAdmin = useIsCompanyAdmin();
  const { data: members = [] } = useCompanyMembers();
  const [scope, setScope] = useState<"all" | "mine">(isAdmin ? "all" : "mine");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, name, job_number, status, primary_trade, total_estimate, property_address, client_id, created_by, assigned_to")
        .order("created_at", { ascending: false });
      return (data ?? []) as Job[];
    },
  });

  const memberMap = new Map<string, CompanyMember>(members.map((m) => [m.id, m]));
  const visibleJobs = scope === "mine" && profile?.id
    ? jobs.filter((j) => j.assigned_to === profile.id || j.created_by === profile.id)
    : jobs;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: JobStatus }) => {
      const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["jobs-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onDragEnd(e: DragEndEvent) {
    const jobId = String(e.active.id);
    const newStatus = e.over?.id as JobStatus | undefined;
    if (!newStatus) return;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === newStatus) return;
    updateStatus.mutate({ id: jobId, status: newStatus });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag cards across columns to update their status.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {JOB_STATUSES.map((col) => (
              <Column
                key={col.value}
                status={col.value}
                label={col.label}
                jobs={jobs.filter((j) => j.status === col.value)}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function Column({ status, label, jobs }: { status: JobStatus; label: string; jobs: Job[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const total = jobs.reduce((s, j) => s + Number(j.total_estimate ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border transition-colors",
        isOver && "ring-1 ring-[var(--brand)]",
      )}
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{label}</span>
          <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 font-mono-num text-[10px] text-muted-foreground">
            {jobs.length}
          </span>
        </div>
        <span className="font-mono-num text-[11px] text-muted-foreground">
          ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="flex-1 space-y-2 p-3">
        {jobs.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
        {jobs.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">No jobs</p>
        )}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...style,
        backgroundColor: "var(--surface-elevated)",
        borderColor: "var(--border)",
      }}
      className={cn(
        "cursor-grab rounded-lg border p-3 text-sm shadow-sm hover:border-[var(--border-strong)]",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between">
        <p className="font-medium text-foreground">{job.name}</p>
        {job.job_number && (
          <span className="font-mono-num text-[10px] text-muted-foreground">{job.job_number}</span>
        )}
      </div>
      {job.property_address && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{job.property_address}</p>
      )}
      <div className="mt-3 flex items-center justify-between">
        {job.primary_trade ? <TradeBadge trade={job.primary_trade} /> : <span />}
        <span className="font-mono-num text-xs font-semibold text-foreground">
          ${Number(job.total_estimate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <Link
        to="/jobs/$id"
        params={{ id: job.id }}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--brand)] hover:underline"
      >
        Open →
      </Link>
    </div>
  );
}
