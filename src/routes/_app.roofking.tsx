import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, KanbanSquare, ListChecks, FileCog, Download, Plus, Search, Target, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { AddCustomerDialog } from "@/components/roofking/CustomerDialogs";
import { NewTicketDialog } from "@/components/roofking/NewTicketDialog";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/roofking/useRKData";
import { RKSearchContext } from "@/components/roofking/RKSearchContext";
import { RK_BRAND } from "@/lib/roofking/brand";

export const Route = createFileRoute("/_app/roofking")({
  component: RoofKingLayout,
});

const TABS = [
  { to: "/roofking", label: "Dashboard", icon: LayoutDashboard },
  { to: "/roofking/customers", label: "Customers", icon: Users },
  { to: "/roofking/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/roofking/tickets", label: "All Tickets", icon: ListChecks },
  { to: "/roofking/forms", label: "Form Builder", icon: FileCog },
  { to: "/roofking/export", label: "Export / CRM", icon: Download },
  { to: "/leads", label: "SPF Prospecting", icon: Target },
] as const;

function isTabActive(pathname: string, to: string) {
  if (to === "/roofking") return pathname === "/roofking" || pathname === "/roofking/";
  return pathname.startsWith(to);
}

function RoofKingLayout() {
  const { isRoofKing, companyId, loading } = useIsRoofKing();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);

  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);

  useEffect(() => {
    if (!loading && !isRoofKing) navigate({ to: "/" });
  }, [loading, isRoofKing, navigate]);



  if (!isRoofKing) return null;

  return (
    <RKSearchContext.Provider value={{ search, setSearch }}>
    <div data-rk className="rk-page-bg -mx-4 -my-4 sm:-mx-6 sm:-my-6 min-h-[calc(100vh-4rem)]">
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-5 sm:px-6">
        {/* Sub-nav */}
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <div className="rk-crown-tile mb-4 flex flex-col items-center gap-2 px-3 py-3">
            <img
              src={RK_BRAND.logoUrl}
              alt="Roof King"
              className="h-16 w-auto object-contain"
            />
            <p className="text-center text-[10px] uppercase tracking-wider text-white/70">{RK_BRAND.tagline}</p>
          </div>
          <nav className="space-y-1">
            {TABS.map((t) => {
              const active = isTabActive(location.pathname, t.to);
              const Icon = t.icon;
              return (
                <Link key={t.to} to={t.to} className={cn("rk-subnav-link", active && "is-active")}>
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 rounded-lg border px-3 py-3 text-[11px] leading-snug" style={{ borderColor: "var(--rk-border)", background: "var(--rk-bg-card)", color: "var(--rk-ink-muted)" }}>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <div>{RK_BRAND.address}</div>
                <div>{RK_BRAND.cityStateZip}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <a href={`tel:${RK_BRAND.phone}`} className="font-medium" style={{ color: "var(--rk-ink)" }}>{RK_BRAND.phone}</a>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0 flex-1">
          {/* Top bar */}
          <div className="rk-card mb-5 flex flex-wrap items-center gap-3 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--rk-ink-faint)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customers, buildings, WO#…"
                className="rk-input pl-9"
              />
            </div>
            <button onClick={() => setShowAddCustomer(true)} className="rk-btn rk-btn-ghost">
              <Plus className="h-3.5 w-3.5" /> Customer
            </button>
            <button onClick={() => setShowNewTicket(true)} className="rk-btn rk-btn-primary">
              <Plus className="h-3.5 w-3.5" /> New Ticket
            </button>
          </div>

          {/* Mobile sub-nav */}
          <div className="mb-4 flex gap-1 overflow-x-auto lg:hidden">
            {TABS.map((t) => {
              const active = isTabActive(location.pathname, t.to);
              const Icon = t.icon;
              return (
                <Link key={t.to} to={t.to} className={cn("rk-subnav-link shrink-0", active && "is-active")}>
                  <Icon className="h-4 w-4" />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>

          <Outlet />
          {/* Pass search via custom event so child routes can opt-in */}
        </div>
      </div>

      {companyId && (
        <>
          <AddCustomerDialog companyId={companyId} open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
          <NewTicketDialog
            companyId={companyId}
            accounts={accounts}
            properties={properties}
            tickets={tickets}
            open={showNewTicket}
            onClose={() => setShowNewTicket(false)}
          />
        </>
      )}
    </div>
    </RKSearchContext.Provider>
  );
}

