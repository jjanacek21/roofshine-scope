import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { useCbCompany } from "@/components/auth/CbCompanyProvider";
import { useCbLogoUrl } from "@/lib/cbLogo";
import {
  CbLockChip,
  useCbFeature,
  useCbFeatureGuard,
} from "@/components/claim-buddy/CbFeatureGate";
import { CbCard, CbTile, CbButton, CbChip, CbLoading } from "@/components/cb/primitives";
import { CbReveal, CbStagger } from "@/components/cb/motion";
import {
  ChevronRight,
  Building2,
  Settings,
  PlayCircle,
  Map as MapIcon,
  BookOpenText,
  ListFilter,
  

} from "lucide-react";
import { toast } from "sonner";

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
  const featureGuard = useCbFeatureGuard();
  const guideAllowed = useCbFeature("survival_guide").allowed;
  const { company, loading: companyLoading } = useCbCompany();
  const { data: profile } = useProfile();
  const logoUrl = useCbLogoUrl(company?.logo_url);

  const [starting, setStarting] = useState(false);

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
              <img
                src={logoUrl}
                alt={`${company?.name ?? "Company"} logo`}
                className="h-full w-full object-contain"
              />
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
          {/* On a phone this chip squeezed the company name down to "G.." — the
              banner right below already says the same thing. */}
          {surface === "platform" ? (
            <span className="hidden sm:inline-flex">
              <CbChip>Inside GlobalContractor</CbChip>
            </span>
          ) : null}
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

      {/* Primary actions */}
      <CbReveal delay={80}>
        <div className="mt-6 space-y-3">
          <CbButton
            block
            variant="secondary"
            onClick={() => {
              if (!featureGuard("survival_guide")) return;
              navigate({ to: "/cb/survival-guide" });
            }}
          >
            <span className="inline-flex items-center gap-2">
              <BookOpenText className="h-4 w-4" /> Survival Guide
              {guideAllowed ? null : <CbLockChip feature="survival_guide" />}
            </span>
          </CbButton>
          <CbButton block variant="secondary" onClick={() => navigate({ to: "/cb/map" })}>
            <span className="inline-flex items-center gap-2">
              <MapIcon className="h-4 w-4" /> Door to Door mode
            </span>
          </CbButton>

          {/* The lead tracker: same jobs, filterable by stage, one file each. */}
          <CbButton block variant="secondary" onClick={() => navigate({ to: "/cb/leads" })}>
            <span className="inline-flex items-center gap-2">
              <ListFilter className="h-4 w-4" /> Leads
            </span>
          </CbButton>
          <CbButton
            block
            loading={starting}
            loadingText="Creating inspection…"
            onClick={startInspection}
          >
            Start Inspection
          </CbButton>
        </div>
      </CbReveal>

      {/* Resume where I left off */}
      {resumeJob ? (
        <CbReveal delay={90}>
          <CbCard
            elevation="raised"
            className="mt-4 cursor-pointer"
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
              <ChevronRight
                className="h-4 w-4 shrink-0"
                style={{ color: "var(--cb-text-muted)" }}
              />
            </div>
          </CbCard>
        </CbReveal>
      ) : null}
    </div>
  );
}
