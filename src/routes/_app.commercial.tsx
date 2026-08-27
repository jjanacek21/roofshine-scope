import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  ListChecks,
  Map as MapIcon,
  FileCog,
  Download,
  Plus,
  Search,
  Target,
  MapPin,
  Phone,
  Calculator,
  Building2,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeatures } from "@/hooks/useFeatures";
import { AddCustomerDialog } from "@/components/commercial/CustomerDialogs";
import { NewTicketDialog } from "@/components/commercial/NewTicketDialog";
import { useRKAccounts, useRKProperties, useRKTickets } from "@/hooks/commercial/useRKData";
import { RKSearchContext } from "@/components/commercial/RKSearchContext";
import { useCompanyBrand } from "@/lib/commercial/brand";

export const Route = createFileRoute("/_app/commercial")({
  component: CommercialLayout,
});

const TABS = [
  { to: "/commercial", label: "Dashboard", icon: LayoutDashboard, feature: "commercial.dashboard" },
  { to: "/commercial/leads", label: "Leads", icon: Briefcase, feature: "commercial.leads" },
  { to: "/commercial/spf", label: "Calculator", icon: Calculator, feature: "commercial.calculator" },
  { to: "/commercial/prospecting", label: "Prospecting", icon: Target, feature: "commercial.prospecting" },
  { to: "/commercial/customers", label: "Customers", icon: Users, feature: "commercial.customers" },
  { to: "/commercial/tickets", label: "Work Orders", icon: ListChecks, feature: "commercial.tickets" },
  { to: "/commercial/pipeline", label: "Pipeline", icon: KanbanSquare, feature: "commercial.pipeline" },
  { to: "/commercial/map", label: "Map", icon: MapIcon, feature: "commercial.map" },
  { to: "/commercial/forms", label: "Forms", icon: FileCog, feature: "commercial.forms" },
  { to: "/commercial/export", label: "Export", icon: Download, feature: "commercial.export" },
] as const;

function isTabActive(pathname: string, to: string) {
  if (to === "/commercial") return pathname === "/commercial" || pathname === "/commercial/";
  return pathname.startsWith(to);
}

function CommercialLayout() {
  const { can, company_id: companyId, loading } = useFeatures();
  const brand = useCompanyBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);

  const hasModule = can("commercial");
  const tabs = TABS.filter((t) => can(t.feature));

  const { data: accounts = [] } = useRKAccounts(companyId);
  const { data: properties = [] } = useRKProperties(companyId);
  const { data: tickets = [] } = useRKTickets(companyId);

  useEffect(() => {
    if (!loading && !hasModule) navigate({ to: "/" });
  }, [loading, hasModule, navigate]);

  if (!hasModule) return null;

  const showCustomerActions = can("commercial.customers");
  const showTicketActions = can("commercial.tickets");

  return (
    <RKSearchContext.Provider value={{ search, setSearch }}>
      <div data-rk className="rk-page-bg -mx-4 -my-4 sm:-mx-6 sm:-my-6 min-h-[calc(100vh-4rem)]">
        <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-5 sm:px-6">
          {/* Sub-nav */}
          <aside className="hidden w-[220px] shrink-0 lg:block">
            <div className="rk-brand-tile mb-4 flex flex-col items-center gap-2 px-3 py-3">
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={brand.name || brand.moduleLabel}
                  className="h-16 w-auto object-contain"
                />
              ) : (
                <Building2 className="h-10 w-10" style={{ color: "var(--rk-ink-faint)" }} />
              )}
              <p className="text-center text-xs font-semibold" style={{ color: "var(--rk-ink)" }}>{brand.name}</p>
              <p className="text-center text-[10px] uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>
                {brand.moduleLabel}
              </p>
            </div>
            <nav className="space-y-1">
              {tabs.map((t) => {
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
            {(brand.address || brand.phone) && (
              <div
                className="mt-5 rounded-lg border px-3 py-3 text-[11px] leading-snug"
                style={{
                  borderColor: "var(--rk-border)",
                  background: "var(--rk-bg-card)",
                  color: "var(--rk-ink-muted)",
                }}
              >
                {brand.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <div>{brand.address}</div>
                      {brand.cityStateZip && <div>{brand.cityStateZip}</div>}
                    </div>
                  </div>
                )}
                {brand.phone && (
                  <div className="mt-2 flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href={`tel:${brand.phone}`}
                      className="font-medium"
                      style={{ color: "var(--rk-ink)" }}
                    >
                      {brand.phone}
                    </a>
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* Main column */}
          <div className="min-w-0 flex-1">
            {/* Top bar */}
            <div className="rk-card mb-5 flex flex-wrap items-center gap-3 p-3">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--rk-ink-faint)" }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customers, buildings, WO#…"
                  className="rk-input pl-9"
                />
              </div>
              {showCustomerActions && (
                <button onClick={() => setShowAddCustomer(true)} className="rk-btn rk-btn-ghost">
                  <Plus className="h-3.5 w-3.5" /> Customer
                </button>
              )}
              {showTicketActions && (
                <button onClick={() => setShowNewTicket(true)} className="rk-btn rk-btn-primary">
                  <Plus className="h-3.5 w-3.5" /> New Ticket
                </button>
              )}
            </div>

            {/* Mobile sub-nav */}
            <div className="mb-4 flex gap-1 overflow-x-auto lg:hidden">
              {tabs.map((t) => {
                const active = isTabActive(location.pathname, t.to);
                const Icon = t.icon;
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={cn("rk-subnav-link shrink-0", active && "is-active")}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t.label}</span>
                  </Link>
                );
              })}
            </div>

            <Outlet />
          </div>
        </div>

        {companyId && (
          <>
            <AddCustomerDialog
              companyId={companyId}
              open={showAddCustomer}
              onClose={() => setShowAddCustomer(false)}
            />
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
