import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatCard } from "@/components/brand/StatCard";
import { TradeMixBar } from "@/components/brand/TradeMixBar";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { StatusBadge } from "@/components/brand/StatusBadge";
import type { Trade } from "@/lib/trades";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

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
        .select(
          "id, name, job_number, status, primary_trade, total_estimate, property_address, updated_at, client_id",
        )
        .order("updated_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name");
      return data ?? [];
    },
  });
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  // Estimates this month (count + total quoted)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startISO = startOfMonth.toISOString();

  const { data: estimatesCount = 0 } = useQuery({
    queryKey: ["estimates-mtd-count", startISO],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("estimates")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startISO);
      return count ?? 0;
    },
  });

  const { data: quotedMTD = 0 } = useQuery({
    queryKey: ["estimates-quoted-mtd", startISO],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("estimates")
        .select("total, status, created_at")
        .gte("created_at", startISO)
        .in("status", ["sent", "approved"]);
      return (data ?? []).reduce((s, e) => s + Number(e.total ?? 0), 0);
    },
  });

  // Trade mix
  const tradeMix: Record<Trade, number> = {
    roofing: 0, exterior: 0, windows: 0, interior: 0,
    hvac: 0, plumbing: 0, electrical: 0, mitigation: 0,
  };
  const activeJobs = jobs.filter((j) => j.status !== "complete");
  for (const j of activeJobs) {
    if (j.primary_trade) tradeMix[j.primary_trade as Trade] += 1;
  }
  const activeTradeCount = Object.values(tradeMix).filter((n) => n > 0).length;

  // Avg job value: avg of jobs.total_estimate over last 30 days
  const last30 = jobs.filter((j) => {
    return Date.now() - new Date(j.updated_at).getTime() < 30 * 24 * 60 * 60 * 1000;
  });
  const totalQuoted = quotedMTD;
  const avgJob = last30.length
    ? last30.reduce((s, j) => s + Number(j.total_estimate ?? 0), 0) / last30.length
    : 0;

  function fmtMoney(n: number, compact = false) {
    if (compact && n >= 1000) {
      return `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K`;
    }
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  const firstName = profile?.first_name ?? "there";

  return (
    <div className="space-y-7">
      {/* Greeting + actions */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1
            className="font-extrabold leading-[1.1] text-foreground"
            style={{ fontSize: 28, letterSpacing: "-0.8px" }}
          >
            {greeting()}, {firstName}
          </h1>
          <p
            className="mt-1.5 text-[14px]"
            style={{ color: "var(--text-muted)" }}
          >
            {activeJobs.length} active jobs across {activeTradeCount}{" "}
            {activeTradeCount === 1 ? "trade" : "trades"}.{" "}
            {estimatesCount} estimate{estimatesCount === 1 ? "" : "s"} on file.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => toast.info("Xactimate import — coming soon")}
            className="btn-ghost flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.4} />
            Import
          </button>
          <button
            onClick={() => toast.info("New Job wizard — coming soon")}
            className="btn-brand flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
            New Job
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Jobs"
          value={activeJobs.length}
          delta={activeJobs.length > 0 ? "this week" : "—"}
          deltaDirection="up"
        />
        <StatCard
          label="Total Estimates"
          value={estimatesCount}
          delta={estimatesCount > 0 ? "on file" : "—"}
          deltaDirection="neutral"
        />
        <StatCard
          label="Total Quoted"
          value={fmtMoney(totalQuoted, true)}
          delta="pipeline"
          deltaDirection="up"
        />
        <StatCard
          label="Avg. Job Value"
          value={fmtMoney(avgJob, true)}
          delta={jobs.length ? `${jobs.length} jobs` : "—"}
          deltaDirection="neutral"
        />
      </div>

      {/* Trade mix */}
      <div className="card-surface p-5">
        <div className="mb-4 flex items-center justify-between border-b pb-3.5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-[14px] font-bold tracking-tight text-foreground">
            Trade Mix · Active Jobs
          </h2>
          <span
            className="font-mono-num text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {activeJobs.length} jobs total
          </span>
        </div>
        <TradeMixBar data={tradeMix} />
      </div>

      {/* Recent jobs */}
      <div className="card-surface overflow-hidden">
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="text-[14px] font-bold tracking-tight text-foreground">
            Recent Jobs
          </h2>
        </div>
        {jobs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No jobs yet. Create your first job to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  {["Job #", "Client", "Property", "Trade", "Status", "Total", "Updated"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-[11px] font-semibold uppercase"
                        style={{
                          color: "var(--text-muted)",
                          letterSpacing: "1.2px",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 8).map((j) => (
                  <tr
                    key={j.id}
                    className="transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td
                      className="px-3 py-3.5 font-mono-num text-[12px]"
                      style={{ color: "var(--text-dim)" }}
                    >
                      <Link to="/jobs/$id" params={{ id: j.id }} className="hover:text-foreground">
                        {j.job_number ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-[13px] font-medium text-foreground">
                      <Link to="/jobs/$id" params={{ id: j.id }} className="hover:text-[var(--brand)]">
                        {j.client_id ? clientMap.get(j.client_id) ?? "—" : "—"}
                      </Link>
                    </td>
                    <td
                      className="px-3 py-3.5 text-[13px]"
                      style={{ color: "var(--text-dim)" }}
                    >
                      <Link to="/jobs/$id" params={{ id: j.id }} className="hover:text-foreground">
                        {j.property_address ?? j.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      {j.primary_trade ? <TradeBadge trade={j.primary_trade} /> : "—"}
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono-num text-[13px] font-semibold text-foreground">
                      {fmtMoney(Number(j.total_estimate))}
                    </td>
                    <td
                      className="px-3 py-3.5 text-[12px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {timeAgo(j.updated_at)}
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
