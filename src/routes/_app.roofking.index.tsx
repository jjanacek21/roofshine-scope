import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Building2, Ticket, AlertCircle, FlameKindling } from "lucide-react";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/roofking/useRKData";
import { KpiCard } from "@/components/roofking/KpiCard";
import { RKStatusBadge } from "@/components/roofking/StatusBadge";
import { TicketDrawer } from "@/components/roofking/TicketDrawer";
import { RK_STATUSES, RK_STATUS_COLORS, RK_STATUS_LABELS } from "@/lib/roofking/types";

export const Route = createFileRoute("/_app/roofking/")({
  component: Dashboard,
});

function Dashboard() {
  const { companyId } = useIsRoofKing();
  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const readyCount = tickets.filter((t) => t.status === "ready").length;
  const inProgressCount = tickets.filter((t) => t.status === "dispatched" || t.status === "field").length;
  const recent = tickets.slice(0, 8);

  const byStage = new Map<string, number>();
  for (const t of tickets) byStage.set(t.status, (byStage.get(t.status) ?? 0) + 1);
  const maxStage = Math.max(1, ...RK_STATUSES.map((s) => byStage.get(s) ?? 0));

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Customers" value={accounts.length} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="Buildings" value={properties.length} icon={<Building2 className="h-4 w-4" />} accent="#a06bff" />
        <KpiCard label="Total Tickets" value={tickets.length} icon={<Ticket className="h-4 w-4" />} accent="#5fa3ff" />
        <KpiCard label="Ready to Invoice" value={readyCount} icon={<AlertCircle className="h-4 w-4" />} accent="#f0a73a" />
        <KpiCard label="In Progress" value={inProgressCount} icon={<FlameKindling className="h-4 w-4" />} accent="#2ec27e" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rk-card rk-fade-in delay-2 lg:col-span-2">
          <div className="border-b p-4" style={{ borderColor: "var(--rk-line)" }}>
            <h3 className="rk-display text-base">Recent Activity</h3>
          </div>
          {recent.length === 0 ? (
            <p className="p-6 text-sm" style={{ color: "var(--rk-ink-faint)" }}>No tickets yet. Create your first ticket from the top bar.</p>
          ) : (
            <ul>
              {recent.map((t) => {
                const a = accountById.get(t.account_id);
                return (
                  <li key={t.id} className="cursor-pointer border-b px-4 py-3 transition-colors hover:bg-[var(--rk-panel-2)]" style={{ borderColor: "var(--rk-line)" }} onClick={() => setOpenTicket(t.id)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rk-num text-xs" style={{ color: "var(--rk-ink-faint)" }}>WO-{t.wo_number ?? "—"}</span>
                          <span className="truncate text-sm font-semibold">{a?.name ?? "—"}</span>
                        </div>
                        <p className="truncate text-xs" style={{ color: "var(--rk-ink-muted)" }}>
                          {t.contact ?? ""}{a?.city ? ` · ${a.city}` : ""}
                        </p>
                      </div>
                      <RKStatusBadge status={t.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rk-card rk-fade-in delay-3 p-4">
          <h3 className="rk-display mb-4 text-base">Pipeline Status</h3>
          <div className="space-y-3">
            {RK_STATUSES.map((s) => {
              const n = byStage.get(s) ?? 0;
              const pct = (n / maxStage) * 100;
              const color = RK_STATUS_COLORS[s];
              return (
                <div key={s}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span style={{ color: "var(--rk-ink-muted)" }}>{RK_STATUS_LABELS[s]}</span>
                    <span className="rk-num font-semibold">{n}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--rk-panel-2)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TicketDrawer ticketId={openTicket} accounts={accounts} properties={properties} onClose={() => setOpenTicket(null)} />
    </div>
  );
}
