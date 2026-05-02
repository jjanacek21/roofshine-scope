import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLeads } from "@/hooks/useLeads";
import { StatCard } from "@/components/brand/StatCard";
import { LEAD_STATUSES, fmtMoney, fmtNum, leadStatusColor } from "@/lib/leads";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_app/leads/")({
  component: LeadsDashboard,
});

function LeadsDashboard() {
  const { data: leads = [], isLoading } = useLeads();
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = leads.length;
    const contacted = leads.filter(
      (l) => l.status !== "new" && l.status !== "lost",
    ).length;
    const qualified = leads.filter(
      (l) => l.status === "qualified" || l.status === "quoted" || l.status === "won",
    ).length;
    const won = leads.filter((l) => l.status === "won");
    const wonValue = won.reduce((a, l) => a + (l.estimated_value ?? 0), 0);
    return {
      total,
      contacted,
      qualified,
      wonCount: won.length,
      wonValue,
      contactRate: total ? Math.round((contacted / total) * 100) : 0,
      qualRate: total ? Math.round((qualified / total) * 100) : 0,
    };
  }, [leads]);

  const pipelineData = useMemo(
    () =>
      LEAD_STATUSES.map((s) => ({
        status: s.label,
        count: leads.filter((l) => l.status === s.value).length,
        color: s.color,
      })),
    [leads],
  );

  const monthlyData = useMemo(() => {
    const buckets: Record<string, number> = {};
    leads.forEach((l) => {
      const d = new Date(l.import_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = (buckets[key] ?? 0) + 1;
    });
    return Object.entries(buckets)
      .sort()
      .slice(-6)
      .map(([k, v]) => ({ month: k, count: v }));
  }, [leads]);

  const recent = leads.slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Leads" value={fmtNum(stats.total)} delta="all time" deltaDirection="neutral" />
        <StatCard label="Contacted" value={fmtNum(stats.contacted)} delta={`${stats.contactRate}% contact rate`} />
        <StatCard label="Qualified" value={fmtNum(stats.qualified)} delta={`${stats.qualRate}% qualification`} />
        <StatCard label="Won" value={fmtNum(stats.wonCount)} delta={`${fmtMoney(stats.wonValue)} pipeline`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Lead Pipeline">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipelineData} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
              <YAxis dataKey="status" type="category" stroke="var(--text-muted)" fontSize={11} width={80} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {pipelineData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Imports">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
              <YAxis stroke="var(--text-muted)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="count" fill="var(--brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <div className="border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold text-foreground">Recent Leads</h2>
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No leads yet — go to Import to add your first batch.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Property</th>
                <th className="px-5 py-3 font-semibold">Owner</th>
                <th className="px-5 py-3 font-semibold">Roof</th>
                <th className="px-5 py-3 font-semibold">Sq Ft</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((l) => (
                <tr
                  key={l.id}
                  className="border-t cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => setOpenId(l.id)}
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">{l.address}</div>
                    <div className="text-xs text-muted-foreground">{l.city}, {l.state}</div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{l.owner ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.roof_type ?? "—"}</td>
                  <td className="px-5 py-3 font-mono-num text-muted-foreground">{fmtNum(l.sqft)}</td>
                  <td className="px-5 py-3">
                    <span style={{ color: leadStatusColor(l.status) }}>
                      <StatusBadge status={l.status} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <LeadDetailSheet leadId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
