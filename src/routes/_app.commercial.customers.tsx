import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Building2, Ticket } from "lucide-react";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/roofking/useRKData";
import { AddBuildingDialog } from "@/components/roofking/CustomerDialogs";
import { NewTicketDialog } from "@/components/roofking/NewTicketDialog";
import { TicketDrawer } from "@/components/roofking/TicketDrawer";
import { useRKSearch } from "@/components/roofking/RKSearchContext";

export const Route = createFileRoute("/_app/roofking/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { companyId } = useIsRoofKing();
  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);
  const { search } = useRKSearch();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addBuildingFor, setAddBuildingFor] = useState<string | null>(null);
  const [newTicketProp, setNewTicketProp] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const propsByAccount = useMemo(() => {
    const m = new Map<string, typeof properties>();
    for (const p of properties) {
      const arr = m.get(p.account_id) ?? [];
      arr.push(p);
      m.set(p.account_id, arr);
    }
    return m;
  }, [properties]);

  const ticketsByProp = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tickets) m.set(t.property_id, (m.get(t.property_id) ?? 0) + 1);
    return m;
  }, [tickets]);

  const ticketsByAccount = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tickets) m.set(t.account_id, (m.get(t.account_id) ?? 0) + 1);
    return m;
  }, [tickets]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? accounts.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.city ?? "").toLowerCase().includes(q) ||
        (a.primary_contact ?? "").toLowerCase().includes(q) ||
        (propsByAccount.get(a.id) ?? []).some((p) => (p.name + " " + (p.address ?? "")).toLowerCase().includes(q)),
      )
    : accounts;

  if (!companyId) return null;

  return (
    <div className="space-y-3">
      {filtered.length === 0 ? (
        <div className="rk-card rk-fade-in p-10 text-center">
          <p className="rk-display text-lg">No customers yet</p>
          <p className="mt-1 text-sm" style={{ color: "var(--rk-ink-muted)" }}>
            Use the "+ Customer" button up top to add your first customer.
          </p>
        </div>
      ) : (
        filtered.map((a, i) => {
          const isOpen = expanded[a.id] ?? false;
          const initials = a.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
          const props = propsByAccount.get(a.id) ?? [];
          return (
            <div key={a.id} className={`rk-card rk-fade-in delay-${Math.min(i + 1, 5)}`}>
              <button
                onClick={() => setExpanded({ ...expanded, [a.id]: !isOpen })}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-[var(--rk-panel-2)]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ background: "linear-gradient(135deg, #2f81f7, #1f6ee0)", color: "#fff" }}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="rk-display truncate text-base">{a.name}</p>
                  <p className="truncate text-xs" style={{ color: "var(--rk-ink-muted)" }}>
                    {[a.primary_contact, a.phone, a.city].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--rk-ink-muted)" }}>
                    <Building2 className="h-3.5 w-3.5" /> <span className="rk-num">{props.length}</span> buildings
                  </span>
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--rk-ink-muted)" }}>
                    <Ticket className="h-3.5 w-3.5" /> <span className="rk-num">{ticketsByAccount.get(a.id) ?? 0}</span> tickets
                  </span>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {isOpen && (
                <div className="border-t p-3" style={{ borderColor: "var(--rk-line)" }}>
                  {props.length === 0 ? (
                    <p className="px-2 py-3 text-xs" style={{ color: "var(--rk-ink-faint)" }}>No buildings yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {props.map((p) => (
                        <li key={p.id} className="rk-panel-2 flex items-center gap-3 rounded-lg p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{p.name}</p>
                            <p className="truncate text-xs" style={{ color: "var(--rk-ink-muted)" }}>
                              {[p.address, [p.city, p.state, p.zip].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || "—"}
                              {p.roof_type ? ` · ${p.roof_type}` : ""}
                            </p>
                          </div>
                          <span className="rk-num text-xs" style={{ color: "var(--rk-ink-muted)" }}>{ticketsByProp.get(p.id) ?? 0} tickets</span>
                          <button onClick={() => setNewTicketProp(p.id)} className="rk-btn rk-btn-primary">
                            <Plus className="h-3.5 w-3.5" /> Ticket
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button onClick={() => setAddBuildingFor(a.id)} className="rk-btn rk-btn-ghost mt-3">
                    <Plus className="h-3.5 w-3.5" /> Add Building
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {addBuildingFor && (
        <AddBuildingDialog
          companyId={companyId}
          accountId={addBuildingFor}
          open={!!addBuildingFor}
          onClose={() => setAddBuildingFor(null)}
        />
      )}
      <NewTicketDialog
        companyId={companyId}
        accounts={accounts}
        properties={properties}
        tickets={tickets}
        open={!!newTicketProp}
        defaultPropertyId={newTicketProp ?? undefined}
        onClose={() => setNewTicketProp(null)}
        onCreated={(t) => setOpenTicket(t.id)}
      />
      <TicketDrawer ticketId={openTicket} accounts={accounts} properties={properties} onClose={() => setOpenTicket(null)} />
    </div>
  );
}
