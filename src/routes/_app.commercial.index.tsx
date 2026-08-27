import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Users,
  Building2,
  Ticket,
  AlertCircle,
  FlameKindling,
  Target,
  Send,
  Briefcase,
  Trophy,
  Calculator,
} from "lucide-react";
import { useFeatures } from "@/hooks/useFeatures";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/commercial/useRKData";
import { useLeadStats, useLeads } from "@/hooks/useLeads";
import { KpiCard } from "@/components/commercial/KpiCard";
import { RKStatusBadge } from "@/components/commercial/StatusBadge";
import { TicketDrawer } from "@/components/commercial/TicketDrawer";
import { RK_STATUSES, RK_STATUS_COLORS, RK_STATUS_LABELS } from "@/lib/commercial/types";
import { LEAD_STATUSES, fmtMoney, leadStatusColor, leadStatusLabel } from "@/lib/leads";
import { useCompanyBrand } from "@/lib/commercial/brand";

export const Route = createFileRoute("/_app/commercial/")({
  component: Dashboard,
});

/** Statuses that represent a live deal, in the order they progress. */
const ACTIVE_LEAD_STATUSES = ["contacted", "report_sent", "proposal_sent"] as const;

function Dashboard() {
  const { can, company_id: companyId } = useFeatures();
  const brand = useCompanyBrand();

  const showTickets = can("commercial.tickets") || can("commercial.customers");
  const showProspecting = can("commercial.prospecting");
  const showLeads = can("commercial.leads");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="rk-display text-2xl">{brand.name || brand.moduleLabel}</h1>
        <p className="text-sm" style={{ color: "var(--rk-ink-muted)" }}>
          {brand.moduleLabel}
        </p>
      </div>

      {(showProspecting || showLeads) && (
        <PipelineSection showProspecting={showProspecting} showLeads={showLeads} />
      )}

      {showTickets && <TicketingSection companyId={companyId} />}

      {!showProspecting && !showLeads && !showTickets && (
        <div className="rk-card p-8 text-center">
          <p className="text-base font-semibold">Nothing enabled yet</p>
          <p className="mt-1 text-sm" style={{ color: "var(--rk-ink-faint)" }}>
            Ask your administrator to turn on prospecting, leads or work orders.
          </p>
        </div>
      )}
    </div>
  );
}

/** Prospecting + leads — the commercial sales pipeline. */
function PipelineSection({
  showProspecting,
  showLeads,
}: {
  showProspecting: boolean;
  showLeads: boolean;
}) {
  const { data: stats } = useLeadStats();
  const { data: leads = [] } = useLeads();
  const { can } = useFeatures();

  const byStatus = stats?.byStatus ?? {};
  const prospects = byStatus["prospect"] ?? 0;
  const reportsSent = byStatus["report_sent"] ?? 0;
  const active = ACTIVE_LEAD_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
  const won = byStatus["won"] ?? 0;

  // Most recently touched deals, prospects excluded — those live in Prospecting.
  const recentLeads = leads.filter((l) => l.status !== "prospect").slice(0, 8);

  const maxStage = Math.max(1, ...LEAD_STATUSES.map((s) => byStatus[s.value] ?? 0));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {showProspecting && (
          <KpiCard
            label="Prospects"
            value={prospects.toLocaleString()}
            hint="Not yet contacted"
            icon={<Target className="h-4 w-4" />}
          />
        )}
        <KpiCard
          label="Reports sent"
          value={reportsSent.toLocaleString()}
          hint="Awaiting a reply"
          icon={<Send className="h-4 w-4" />}
          accent="#f97316"
        />
        {showLeads && (
          <KpiCard
            label="Active leads"
            value={active.toLocaleString()}
            hint="Contacted through proposal"
            icon={<Briefcase className="h-4 w-4" />}
            accent="#5fa3ff"
          />
        )}
        <KpiCard
          label="Won"
          value={won.toLocaleString()}
          hint={stats ? fmtMoney(stats.wonValue) : undefined}
          icon={<Trophy className="h-4 w-4" />}
          accent="var(--rk-green)"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {showProspecting && (
          <Link to="/leads" className="rk-btn rk-btn-primary">
            <Target className="h-3.5 w-3.5" /> Open prospecting
          </Link>
        )}
        {showLeads && (
          <Link to="/commercial/leads" className="rk-btn rk-btn-ghost">
            <Briefcase className="h-3.5 w-3.5" /> View leads
          </Link>
        )}
        {can("commercial.calculator") && (
          <Link to="/commercial/spf" className="rk-btn rk-btn-ghost">
            <Calculator className="h-3.5 w-3.5" /> Calculator
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {showLeads && (
          <div className="rk-card rk-fade-in delay-2 lg:col-span-2">
            <div className="border-b p-4" style={{ borderColor: "var(--rk-line)" }}>
              <h3 className="rk-display text-base">Recent leads</h3>
            </div>
            {recentLeads.length === 0 ? (
              <p className="p-6 text-sm" style={{ color: "var(--rk-ink-faint)" }}>
                No active leads yet. Convert a prospect once you have made contact.
              </p>
            ) : (
              <ul>
                {recentLeads.map((l) => (
                  <li
                    key={l.id}
                    className="border-b px-4 py-3"
                    style={{ borderColor: "var(--rk-line)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{l.address}</div>
                        <p className="truncate text-xs" style={{ color: "var(--rk-ink-muted)" }}>
                          {[l.owner, l.city].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <span
                        className="rk-status-pill shrink-0"
                        style={{
                          color: leadStatusColor(l.status),
                          background: "var(--rk-panel-2)",
                        }}
                      >
                        {leadStatusLabel(l.status)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="rk-card rk-fade-in delay-3 p-4">
          <h3 className="rk-display mb-4 text-base">Pipeline</h3>
          <div className="space-y-3">
            {LEAD_STATUSES.filter((s) => s.value !== "dnc").map((s) => {
              const n = byStatus[s.value] ?? 0;
              const pct = (n / maxStage) * 100;
              return (
                <div key={s.value}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span style={{ color: "var(--rk-ink-muted)" }}>{s.label}</span>
                    <span className="rk-num font-semibold">{n}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--rk-panel-2)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/** Work orders — only for companies running the ticketing side of the module. */
function TicketingSection({ companyId }: { companyId: string | null }) {
  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const readyCount = tickets.filter((t) => t.status === "ready").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "dispatched" || t.status === "field",
  ).length;
  const recent = tickets.slice(0, 8);

  const byStage = new Map<string, number>();
  for (const t of tickets) byStage.set(t.status, (byStage.get(t.status) ?? 0) + 1);
  const maxStage = Math.max(1, ...RK_STATUSES.map((s) => byStage.get(s) ?? 0));

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Customers" value={accounts.length} icon={<Users className="h-4 w-4" />} />
        <KpiCard
          label="Buildings"
          value={properties.length}
          icon={<Building2 className="h-4 w-4" />}
          accent="#a06bff"
        />
        <KpiCard
          label="Total Tickets"
          value={tickets.length}
          icon={<Ticket className="h-4 w-4" />}
          accent="#5fa3ff"
        />
        <KpiCard
          label="Ready to Invoice"
          value={readyCount}
          icon={<AlertCircle className="h-4 w-4" />}
          accent="var(--brand)"
        />
        <KpiCard
          label="In Progress"
          value={inProgressCount}
          icon={<FlameKindling className="h-4 w-4" />}
          accent="#2ec27e"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rk-card rk-fade-in delay-2 lg:col-span-2">
          <div className="border-b p-4" style={{ borderColor: "var(--rk-line)" }}>
            <h3 className="rk-display text-base">Recent Activity</h3>
          </div>
          {recent.length === 0 ? (
            <p className="p-6 text-sm" style={{ color: "var(--rk-ink-faint)" }}>
              No tickets yet. Create your first ticket from the top bar.
            </p>
          ) : (
            <ul>
              {recent.map((t) => {
                const a = accountById.get(t.account_id);
                return (
                  <li
                    key={t.id}
                    className="cursor-pointer border-b px-4 py-3 transition-colors hover:bg-[var(--rk-panel-2)]"
                    style={{ borderColor: "var(--rk-line)" }}
                    onClick={() => setOpenTicket(t.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rk-num text-xs" style={{ color: "var(--rk-ink-faint)" }}>
                            WO-{t.wo_number ?? "—"}
                          </span>
                          <span className="truncate text-sm font-semibold">{a?.name ?? "—"}</span>
                        </div>
                        <p className="truncate text-xs" style={{ color: "var(--rk-ink-muted)" }}>
                          {t.contact ?? ""}
                          {a?.city ? ` · ${a.city}` : ""}
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
          <h3 className="rk-display mb-4 text-base">Work order status</h3>
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
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TicketDrawer
        ticketId={openTicket}
        accounts={accounts}
        properties={properties}
        onClose={() => setOpenTicket(null)}
      />
    </>
  );
}
