import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/roofking/useRKData";
import { RKStatusBadge } from "@/components/roofking/StatusBadge";
import { TicketDrawer } from "@/components/roofking/TicketDrawer";
import { useRKSearch } from "@/components/roofking/RKSearchContext";

export const Route = createFileRoute("/_app/roofking/tickets")({
  component: TicketsPage,
});

const PAGE_SIZE = 50;

function TicketsPage() {
  const { companyId } = useIsRoofKing();
  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);
  const { search } = useRKSearch();
  const [page, setPage] = useState(0);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const propById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return tickets;
    return tickets.filter((t) => {
      const a = accountById.get(t.account_id);
      const p = propById.get(t.property_id);
      return (
        String(t.wo_number ?? "").includes(q) ||
        (a?.name ?? "").toLowerCase().includes(q) ||
        (p?.name ?? "").toLowerCase().includes(q) ||
        (t.contact ?? "").toLowerCase().includes(q) ||
        (a?.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, q, accountById, propById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="rk-card rk-fade-in overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--rk-panel-2)" }}>
                <Th>WO #</Th>
                <Th>Customer</Th>
                <Th>Building</Th>
                <Th>Service Date</Th>
                <Th>Status</Th>
                <Th className="text-right">Price</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-sm" style={{ color: "var(--rk-ink-faint)" }}>No tickets.</td>
                </tr>
              ) : pageRows.map((t) => {
                const a = accountById.get(t.account_id);
                const p = propById.get(t.property_id);
                return (
                  <tr key={t.id} className="cursor-pointer border-t transition-colors hover:bg-[var(--rk-panel-2)]" style={{ borderColor: "var(--rk-line)" }} onClick={() => setOpenTicket(t.id)}>
                    <Td className="rk-num">WO-{t.wo_number ?? "—"}</Td>
                    <Td className="font-semibold">{a?.name ?? "—"}</Td>
                    <Td><span className="truncate" style={{ color: "var(--rk-ink-muted)" }}>{p?.name ?? "—"}</span></Td>
                    <Td><span className="rk-num">{t.service_date ?? "—"}</span></Td>
                    <Td><RKStatusBadge status={t.status} /></Td>
                    <Td className="rk-num text-right">{t.price != null ? `$${Number(t.price).toFixed(2)}` : "—"}</Td>
                    <Td><span className="rk-num text-xs" style={{ color: "var(--rk-ink-faint)" }}>{new Date(t.updated_at).toLocaleDateString()}</span></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-xs" style={{ color: "var(--rk-ink-muted)" }}>
          <span>
            Showing <span className="rk-num">{page * PAGE_SIZE + 1}</span>–<span className="rk-num">{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span> of <span className="rk-num">{filtered.length}</span>
          </span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rk-btn rk-btn-ghost">Prev</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="rk-btn rk-btn-ghost">Next</button>
          </div>
        </div>
      )}

      <TicketDrawer ticketId={openTicket} accounts={accounts} properties={properties} onClose={() => setOpenTicket(null)} />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`p-3 text-left text-[11px] font-semibold uppercase tracking-wider ${className}`} style={{ color: "var(--rk-ink-faint)" }}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 align-middle ${className}`}>{children}</td>;
}
