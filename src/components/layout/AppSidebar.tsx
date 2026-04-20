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
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

const WORKSPACE_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, badgeKey: null },
  { to: "/jobs", label: "Jobs", icon: Briefcase, badgeKey: "jobs" as const },
  { to: "/clients", label: "Clients", icon: Users, badgeKey: null },
] as const;

const ADMIN_NAV = [
  { to: "/price-books", label: "Pricing", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const isSuperAdmin = profile?.role === "super_admin";
  const isCompanyAdmin =
    profile?.role === "owner" ||
    profile?.role === "admin" ||
    isSuperAdmin;

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

  return (
    <aside
      className="sidebar-bg fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col overflow-y-auto border-r p-4 lg:flex"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 border-b px-2 pb-7 pt-2"
        style={{ borderColor: "var(--border)" }}
      >
        <Logo size="sm" />
      </div>

      {/* Workspace */}
      <div className="mt-5">
        <p
          className="px-2.5 pb-2 pt-3 text-[10px] font-semibold uppercase"
          style={{ color: "var(--text-muted)", letterSpacing: "1.5px" }}
        >
          Workspace
        </p>
        <nav className="space-y-1">
          {WORKSPACE_NAV.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "nav-active"
                    : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{item.label}</span>
                {item.badgeKey === "jobs" && jobsCount > 0 && (
                  <span
                    className="ml-auto rounded font-mono-num text-[10px] font-bold text-white"
                    style={{
                      background: "var(--brand)",
                      padding: "2px 6px",
                    }}
                  >
                    {jobsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Admin */}
      <div className="mt-2">
        <p
          className="px-2.5 pb-2 pt-3 text-[10px] font-semibold uppercase"
          style={{ color: "var(--text-muted)", letterSpacing: "1.5px" }}
        >
          Admin
        </p>
        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "nav-active"
                    : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {isCompanyAdmin && (
            <Link
              to="/team"
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                isActive("/team")
                  ? "nav-active"
                  : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
              )}
            >
              <UserCog className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span>Team</span>
            </Link>
          )}
          {isSuperAdmin && (
            <Link
              to="/admin"
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                isActive("/admin")
                  ? "nav-active"
                  : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
              )}
            >
              <Shield className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span>Admin Portal</span>
            </Link>
          )}
        </nav>
      </div>

      {/* User chip */}
      <div
        className="mt-auto border-t pt-5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-[var(--bg-hover)]">
          <div
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-white uppercase"
            style={{
              background: "linear-gradient(135deg, var(--brand), var(--brand-dim))",
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              {fullName}
            </p>
            <p
              className="truncate text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {user?.email}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="text-[var(--text-muted)] transition-colors hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
