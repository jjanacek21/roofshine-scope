import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Library,
  Settings,
  LogOut,
  UserCog,
  Shield,
  Target,
  IdCard,
  Receipt,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Crown,
  CloudLightning,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const WORKSPACE_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, badgeKey: null },
  { to: "/clients", label: "Clients", icon: Users, badgeKey: null },
  { to: "/jobs", label: "Jobs", icon: Briefcase, badgeKey: "jobs" as const },
  { to: "/leads", label: "SPF Prospecting", icon: Target, badgeKey: null },
  { to: "/door-to-door", label: "Door to Door", icon: DoorOpen, badgeKey: null },
  { to: "/storm-intelligence", label: "Storm Intel", icon: CloudLightning, badgeKey: null },
  { to: "/card", label: "My Card", icon: IdCard, badgeKey: null },
] as const;

const RESOURCES_NAV = [
  { to: "/survival-guide", label: "Survival Guide", icon: BookOpenText },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { isRoofKing } = useIsRoofKing();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const isSuperAdmin = profile?.role === "super_admin";
  const isCompanyAdmin =
    profile?.role === "owner" || profile?.role === "admin" || isSuperAdmin;

  const { data: jobsCount = 0 } = useQuery({
    queryKey: ["sidebar-jobs-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "User";
  const initials =
    (profile?.first_name?.[0] ?? "") + (profile?.last_name?.[0] ?? "") ||
    user?.email?.[0]?.toUpperCase() ||
    "U";

  function isActive(to: string) {
    return to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
  }

  const width = collapsed ? "72px" : "240px";

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className="sidebar-bg fixed inset-y-0 left-0 z-30 hidden flex-col overflow-y-auto border-r p-3 lg:flex transition-[width] duration-200"
        style={{ borderColor: "var(--border)", width }}
      >
        {/* Logo + collapse toggle */}
        <div
          className={cn(
            "flex items-center border-b pb-5 pt-1",
            collapsed ? "justify-center" : "justify-between px-1",
          )}
          style={{ borderColor: "var(--border)" }}
        >
          {!collapsed && <Logo size="sm" />}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Workspace */}
        <div className="mt-4">
          {!collapsed && (
            <p
              className="px-2.5 pb-2 pt-1 text-[10px] font-semibold uppercase"
              style={{ color: "var(--text-muted)", letterSpacing: "1.5px" }}
            >
              Workspace
            </p>
          )}
          <nav className="space-y-1">
            {WORKSPACE_NAV.filter((i) => !(isRoofKing && i.to === "/leads")).map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    collapsed && "justify-center",
                    active
                      ? "nav-active"
                      : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.badgeKey === "jobs" && jobsCount > 0 && (
                    <span
                      className="ml-auto rounded font-mono-num text-[10px] font-bold text-white"
                      style={{ background: "var(--brand)", padding: "2px 6px" }}
                    >
                      {jobsCount}
                    </span>
                  )}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
            {isRoofKing && (() => {
              const active = isActive("/roofking");
              const link = (
                <Link
                  to="/roofking"
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    collapsed && "justify-center",
                    active
                      ? "nav-active"
                      : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                  )}
                >
                  <Crown className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: active ? undefined : "#f0a73a" }} />
                  {!collapsed && <span>Roof King</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key="roofking">
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">Roof King</TooltipContent>
                </Tooltip>
              ) : (
                <div key="roofking">{link}</div>
              );
            })()}
          </nav>
        </div>

        {/* Resources */}
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {!collapsed && (
            <p
              className="px-2.5 pb-2 pt-1 text-[10px] font-semibold uppercase"
              style={{ color: "var(--text-muted)", letterSpacing: "1.5px" }}
            >
              Resources
            </p>
          )}
          <nav className="space-y-1">
            {RESOURCES_NAV.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    collapsed && "justify-center",
                    active
                      ? "nav-active"
                      : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </nav>
        </div>

        {/* User chip — opens admin popover */}
        <div
          className="mt-auto border-t pt-4"
          style={{ borderColor: "var(--border)" }}
        >
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-[var(--bg-hover)]",
                  collapsed && "justify-center",
                )}
              >
                <div
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase text-white"
                  style={{
                    background: "linear-gradient(135deg, var(--brand), var(--brand-dim))",
                  }}
                >
                  {initials}
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{fullName}</p>
                    <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {user?.email}
                    </p>
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="w-56 p-1.5"
            >
              {!collapsed === false && (
                <div className="border-b px-2 pb-2 pt-1" style={{ borderColor: "var(--border)" }}>
                  <p className="truncate text-xs font-semibold text-foreground">{fullName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
                </div>
              )}
              <MenuLink to="/price-books" icon={Library} label="Pricing" />
              <MenuLink to="/settings" icon={Settings} label="Settings" />
              {isCompanyAdmin && <MenuLink to="/team" icon={UserCog} label="Team" />}
              {isSuperAdmin && <MenuLink to="/admin" icon={Shield} label="Admin Portal" />}
              <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
              <button
                onClick={() => signOut()}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </aside>
    </TooltipProvider>
  );
}

function MenuLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Library;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}
