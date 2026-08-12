import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Menu,
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
  DoorOpen,
  CloudLightning,
  ShieldCheck,
  Crown,
  BookOpenText,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useCompanyFeatures } from "@/hooks/useCompanyFeatures";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const WORKSPACE_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, badgeKey: null },
  { to: "/jobs", label: "Jobs", icon: Briefcase, badgeKey: "jobs" as const },
  { to: "/leads", label: "SPF Prospecting", icon: Target, badgeKey: null },
  { to: "/clients", label: "Clients", icon: Users, badgeKey: null },
  { to: "/door-to-door", label: "Door to Door", icon: DoorOpen, badgeKey: null },
  { to: "/storm-intelligence", label: "Storm Intel", icon: CloudLightning, badgeKey: null },
  { to: "/claim-buddy", label: "Claim Buddy", icon: ShieldCheck, badgeKey: "cb" as const },
  { to: "/card", label: "My Card", icon: IdCard, badgeKey: null },
] as const;

const RESOURCES_NAV = [
  { to: "/survival-guide", label: "Survival Guide", icon: BookOpenText },
] as const;

const ADMIN_NAV = [
  { to: "/price-books", label: "Pricing", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function MobileSidebarSheet() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { isRoofKing } = useIsRoofKing();
  const features = useCompanyFeatures();
  const isSuperAdmin = profile?.role === "super_admin";
  const isCompanyAdmin =
    profile?.role === "owner" || profile?.role === "admin" || isSuperAdmin;


  const { data: jobsCount = 0 } = useQuery({
    queryKey: ["sidebar-jobs-count", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { count } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("company_id", profile!.company_id!);
      return count ?? 0;
    },
  });

  const { data: cbOpenCount = 0 } = useQuery({
    queryKey: ["cb-open-inspections", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("cb_jobs")
        .select("*", { count: "exact", head: true })
        .in("status", ["draft", "inspecting", "report_ready", "presented", "signed"]);
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

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)] lg:hidden"
          style={{ color: "var(--text-muted)" }}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="sidebar-bg w-[260px] border-r p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        <div
          className="flex items-center gap-3 border-b px-2 pb-5"
          style={{ borderColor: "var(--border)" }}
        >
          <Logo size="sm" />
        </div>

        <div className="mt-5">
          <p
            className="px-2.5 pb-2 pt-3 text-[10px] font-semibold uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "1.5px" }}
          >
            Workspace
          </p>
          <nav className="space-y-1">
            {WORKSPACE_NAV.filter((i) => {
              if (isRoofKing && i.to === "/leads") return false;
              if (i.to === "/door-to-door" && !features.doorToDoor) return false;
              if (i.to === "/storm-intelligence" && !features.stormIntel) return false;
              return true;
            }).map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={close}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "nav-active"
                      : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{item.label}</span>
                  {((item.badgeKey === "jobs" && jobsCount > 0) ||
                    (item.badgeKey === "cb" && cbOpenCount > 0)) && (
                    <span
                      className="ml-auto rounded font-mono-num text-[10px] font-bold text-white"
                      style={{ background: "var(--brand)", padding: "2px 6px" }}
                    >
                      {item.badgeKey === "cb" ? cbOpenCount : jobsCount}
                    </span>
                  )}
                </Link>
              );
            })}
            {isRoofKing && (
              <Link
                to="/roofking"
                onClick={close}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                  isActive("/roofking")
                    ? "nav-active"
                    : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                )}
              >
                <Crown
                  className="h-4 w-4 shrink-0"
                  strokeWidth={2}
                  style={{ color: isActive("/roofking") ? undefined : "#f0a73a" }}
                />
                <span>Roof King</span>
              </Link>
            )}
          </nav>
        </div>

        <div className="mt-2">
          <p
            className="px-2.5 pb-2 pt-3 text-[10px] font-semibold uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "1.5px" }}
          >
            Resources
          </p>
          <nav className="space-y-1">
            {RESOURCES_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={close}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive(item.to)
                      ? "nav-active"
                      : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>


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
                  onClick={close}
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
                onClick={close}
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
                onClick={close}
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

        <div
          className="mt-6 border-t pt-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2.5 rounded-lg p-2">
            <div
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-xs font-bold text-white uppercase"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand), var(--brand-dim))",
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
              onClick={() => {
                close();
                signOut();
              }}
              className="text-[var(--text-muted)] transition-colors hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
