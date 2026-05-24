import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Briefcase, Users, Target, BookOpenText } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/leads", label: "Prospector", icon: Target },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/survival-guide", label: "Guide", icon: BookOpenText },
] as const;

export function MobileBottomTabs() {
  const location = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t backdrop-blur-md sm:hidden"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "rgba(10, 10, 11, 0.85)",
      }}
    >
      {TABS.map((t) => {
        const active =
          t.to === "/" ? location.pathname === "/" : location.pathname.startsWith(t.to);
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium",
              active ? "text-[var(--brand)]" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
