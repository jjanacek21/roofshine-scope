import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  BookOpen,
  Library,
  Settings,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/catalog", label: "Catalog", icon: BookOpen },
  { to: "/price-books", label: "Price Books", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <aside
      className="sidebar-bg fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r lg:flex"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "nav-active"
                  : "text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="m-3 rounded-lg border p-3"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              {user?.email}
            </p>
            <p className="text-[10px] text-muted-foreground">Signed in</p>
          </div>
          <button
            onClick={() => signOut()}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
