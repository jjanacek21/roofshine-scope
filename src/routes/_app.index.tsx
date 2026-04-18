import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatCard } from "@/components/brand/StatCard";
import { TradeMixBar } from "@/components/brand/TradeMixBar";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Briefcase, DollarSign, FileText, Users } from "lucide-react";
import type { Trade } from "@/lib/trades";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, name, job_number, status, primary_trade, total_estimate, property_address, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: clientCount = 0 } = useQuery({
    queryKey: ["clients-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: estimatesCount = 0 } = useQuery({
    queryKey: ["estimates-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("estimates")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  // Build trade-mix data from jobs.primary_trade
  const tradeMix: Record<Trade, number> = {
    roofing: 0, exterior: 0, windows: 0, interior: 0,
    hvac: 0, plumbing: 0, electrical: 0, mitigation: 0,
  };
  for (const j of jobs) {
    if (j.primary_trade) tradeMix[j.primary_trade as Trade] = (tradeMix[j.primary_trade as Trade] ?? 0) + 1;
  }
  const totalPipeline = jobs.reduce((sum, j) => sum + Number(j.total_estimate ?? 0), 0);

  const firstName = profile?.first_name ?? "there";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Hello, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening across your jobs today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Jobs" value={jobs.length} icon={<Briefcase className="h-4 w-4" />} />
        <StatCard
          label="Pipeline"
          value={`$${totalPipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard label="Estimates" value={estimatesCount} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Clients" value={clientCount} icon={<Users className="h-4 w-4" />} />
      </div>

      {/* Trade mix */}
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Trade Mix
          </h2>
          <span className="font-mono-num text-xs text-muted-foreground">
            {jobs.length} jobs
          </span>
        </div>
        <TradeMixBar data={tradeMix} />
      </div>

      {/* Recent jobs */}
      <div
        className="rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        <div className="border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Jobs
          </h2>
        </div>
        {jobs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No jobs yet. Create your first job to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-semibold">Job #</th>
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Trade</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 8).map((j) => (
                  <tr
                    key={j.id}
                    className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-6 py-3 font-mono-num text-muted-foreground">
                      {j.job_number ?? "—"}
                    </td>
                    <td className="px-6 py-3 font-medium text-foreground">{j.name}</td>
                    <td className="px-6 py-3">
                      {j.primary_trade ? <TradeBadge trade={j.primary_trade} /> : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="px-6 py-3 text-right font-mono-num font-semibold text-foreground">
                      ${Number(j.total_estimate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
