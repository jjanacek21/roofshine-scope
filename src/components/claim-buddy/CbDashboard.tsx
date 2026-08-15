import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { useCbCompany } from "@/components/auth/CbCompanyProvider";
import { useCbLogoUrl } from "@/lib/cbLogo";
import { CbCard, CbTile, CbButton, CbChip, CbBadge, CbLoading, CbEmptyState, CbSkeleton } from "@/components/cb/primitives";
import { CbReveal, CbStagger } from "@/components/cb/motion";
import { CbConvertAction } from "@/components/cb/CbConvertAction";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Camera, ChevronRight, Building2, Settings, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES: { value: string; label: string; tone: "neutral" | "success" | "warning" | "danger" | "accent" }[] = [
  { value: "draft", label: "Draft", tone: "neutral" },
  { value: "inspecting", label: "Inspecting", tone: "warning" },
  { value: "report_ready", label: "Report ready", tone: "accent" },
  { value: "presented", label: "Presented", tone: "accent" },
  { value: "signed", label: "Signed", tone: "success" },
  { value: "converted", label: "Converted", tone: "success" },
];

function statusMeta(value: string | null) {
  return STATUSES.find((s) => s.value === value) ?? { value: value ?? "draft", label: value ?? "Draft", tone: "neutral" as const };
}

interface CbJobRow {
  id: string;
  address: string | null;
  customer_name: string | null;
  status: string | null;
  updated_at: string;
  created_at: string;
}

export function CbDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace, surface, loading: sessionLoading } = useCbSession();
  const { company, loading: companyLoading } = useCbCompany();
  const { data: profile } = useProfile();
  const logoUrl = useCbLogoUrl(company?.logo_url);

  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CbJobRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: ["cb-jobs", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_jobs")
        .select("id, address, customer_name, status, updated_at, created_at")
        .eq("workspace_id", workspace!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CbJobRow[];
    },
  });

  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);

  const photosQuery = useQuery({
    queryKey: ["cb-photo-counts", workspace?.id, jobs.length],
    enabled: !!workspace?.id && jobs.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_photos")
        .select("job_id")
        .in(
          "job_id",
          jobs.map((j) => j.id),
        );
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.job_id] = (counts[row.job_id] ?? 0) + 1;
      return counts;
    },
  });
  const photoCounts = photosQuery.data ?? {};

  const stats = useMemo(() => {
    const now = Date.now();
    const week = now - 7 * 864e5;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      thisWeek: jobs.filter((j) => new Date(j.created_at).getTime() >= week).length,
      reportsReady: jobs.filter((j) => j.status === "report_ready").length,
      signedThisMonth: jobs.filter(
        (j) =>
          (j.status === "signed" || j.status === "converted") &&
          new Date(j.updated_at).getTime() >= monthStart.getTime(),
      ).length,
    };
  }, [jobs]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter && j.status !== filter) return false;
      if (!q) return true;
      return (
        (j.address ?? "").toLowerCase().includes(q) || (j.customer_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [jobs, filter, search]);

  /* A brand-new workspace gets one demo inspection so the whole flow is walkable. */
  useEffect(() => {
    if (!workspace?.id || jobsQuery.isLoading || jobs.length > 0) return;
    let cancelled = false;
    void supabase.rpc("cb_ensure_demo_job", { _ws: workspace.id }).then(({ data }) => {
      if (cancelled) return;
      if ((data as { created?: boolean } | null)?.created) void jobsQuery.refetch();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, jobsQuery.isLoading, jobs.length]);

  /* The job the rep was last in the middle of. */
  const resumeJob = useMemo(
    () => jobs.find((j) => j.status === "inspecting" || j.status === "draft") ?? null,
    [jobs],
  );


  async function startInspection() {
    if (!workspace || !company || !user) return;
    setStarting(true);
    const { data, error } = await supabase
      .from("cb_jobs")
      .insert({
        workspace_id: workspace.id,
        company_id: company.id,
        created_by: user.id,
        status: "draft",
      })
      .select("id")
      .single();
    setStarting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not start the inspection");
      return;
    }
    navigate({ to: "/cb/job/$id/customer", params: { id: data.id } });
  }

  if (sessionLoading || companyLoading) {
    return (
      <div className="mx-auto w-full max-w-[840px] px-5 py-10">
        <CbLoading label="Loading your workspace…" />
      </div>
    );
  }

  const repName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "";

  return (
    <div className="mx-auto w-full max-w-[840px] px-5 pb-24 pt-8">
      {/* Header */}
      <CbReveal>
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
            style={{
              background: "var(--cb-surface-sunken, rgba(0,0,0,.05))",
              border: "1px solid var(--cb-hairline, rgba(0,0,0,.1))",
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={`${company?.name ?? "Company"} logo`} className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="cb-display truncate" style={{ fontSize: 20, lineHeight: 1.2 }}>
              {company?.name ?? "Claim Buddy"}
            </h1>
            <p className="truncate text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {repName}
            </p>
          </div>
          {surface === "platform" ? <CbChip>Inside GlobalContractor</CbChip> : null}
          <button
            type="button"
            aria-label="Settings"
            onClick={() => navigate({ to: "/cb/settings" })}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px]"
            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
          >
            <Settings className="h-4.5 w-4.5" />
          </button>

        </div>
      </CbReveal>

      {surface === "platform" && company ? (
        <CbReveal delay={60}>
          <div
            className="mt-4 rounded-[14px] px-4 py-3 text-[12.5px]"
            style={{
              background: "var(--cb-surface-sunken, rgba(0,0,0,.05))",
              border: "1px solid var(--cb-hairline, rgba(0,0,0,.1))",
              color: "var(--cb-text-muted)",
            }}
          >
            Working as <strong>{company.name}</strong> — branding managed in GlobalContractor.
          </div>
        </CbReveal>
      ) : null}

      {/* Stats */}
      <CbStagger className="mt-6 grid grid-cols-3 gap-3">
        <CbTile label="Inspections this week" value={stats.thisWeek} />
        <CbTile label="Reports ready" value={stats.reportsReady} />
        <CbTile label="Signed this month" value={stats.signedThisMonth} />
      </CbStagger>

      {/* Resume where I left off */}
      {resumeJob ? (
        <CbReveal delay={70}>
          <CbCard
            elevation="raised"
            className="mt-5 cursor-pointer"
            style={{ padding: 16 }}
            onClick={() => navigate({ to: "/cb/job/$id/customer", params: { id: resumeJob.id } })}
          >
            <div className="flex items-center gap-3">
              <PlayCircle className="h-6 w-6 shrink-0" style={{ color: "var(--cb-accent)" }} />
              <div className="min-w-0 flex-1">
                <p className="cb-microlabel">Pick up where you left off</p>
                <p className="truncate text-[15px] font-semibold">
                  {resumeJob.address || "New inspection"}
                </p>
                <p className="truncate text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                  {resumeJob.customer_name || "No customer yet"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--cb-text-muted)" }} />
            </div>
          </CbCard>
        </CbReveal>
      ) : null}

      {/* Primary action */}
      <CbReveal delay={80}>
        <div className="mt-6">
          <CbButton block loading={starting} loadingText="Creating inspection…" onClick={startInspection}>
            Start Inspection
          </CbButton>
        </div>
      </CbReveal>

      {/* Search + filters */}
      <CbReveal delay={110}>
        <div className="mt-7">
          <div
            className="flex h-[52px] items-center gap-2 rounded-[14px] px-4"
            style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
          >
            <Search className="h-4 w-4" style={{ color: "var(--cb-text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search address or customer"
              aria-label="Search inspections"
              className="h-full flex-1 bg-transparent text-[14px] outline-none"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip label="All" active={filter === null} onClick={() => setFilter(null)} />
            {STATUSES.map((s) => (
              <FilterChip
                key={s.value}
                label={s.label}
                active={filter === s.value}
                onClick={() => setFilter(filter === s.value ? null : s.value)}
              />
            ))}
          </div>
        </div>
      </CbReveal>

      {/* Job list */}
      <div className="mt-5 space-y-3">
        {jobsQuery.isLoading ? (
          <>
            <CbSkeleton height={78} radius={18} />
            <CbSkeleton height={78} radius={18} />
          </>
        ) : visible.length === 0 ? (
          <CbEmptyState
            headline={jobs.length === 0 ? "No inspections yet — let's go get one." : "Nothing matches that filter."}
            action={
              jobs.length === 0 ? (
                <CbButton onClick={startInspection} loading={starting} loadingText="Creating inspection…">
                  Start Inspection
                </CbButton>
              ) : undefined
            }
          />
        ) : (
          <CbStagger className="space-y-3">
            {visible.map((job) => {
              const meta = statusMeta(job.status);
              return (
                <CbCard
                  key={job.id}
                  elevation="card"
                  className="cursor-pointer"
                  style={{ padding: 16 }}
                  onClick={() => navigate({ to: "/cb/job/$id/customer", params: { id: job.id } })}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{job.address || "New inspection"}</p>
                      <p className="truncate text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                        {job.customer_name || "No customer yet"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CbBadge tone={meta.tone}>{meta.label}</CbBadge>
                        <span
                          className="inline-flex items-center gap-1 text-[11.5px]"
                          style={{ color: "var(--cb-text-muted)" }}
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span className="cb-num">{photoCounts[job.id] ?? 0}</span>
                        </span>
                        <span className="text-[11.5px]" style={{ color: "var(--cb-text-muted)" }}>
                          {new Date(job.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {job.status === "report_ready" ||
                      job.status === "presented" ||
                      job.status === "signed" ||
                      job.status === "converted" ? (
                        <CbConvertAction jobId={job.id} size="compact" />
                      ) : null}
                      {job.status === "report_ready" || job.status === "presented" ? (
                        <CbButton
                          size="md"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({ to: "/cb/job/$id/present", params: { id: job.id } });
                          }}
                        >
                          Present
                        </CbButton>
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--cb-text-muted)" }} />

                  </div>
                </CbCard>
              );
            })}
          </CbStagger>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cb-chip ${active ? "is-active" : ""}`}
      style={
        active
          ? { background: "var(--cb-accent)", color: "#fff", borderColor: "transparent" }
          : undefined
      }
    >
      {label}
    </button>
  );
}
