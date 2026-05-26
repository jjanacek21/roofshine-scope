import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { DoorOpen, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/door-to-door")({
  component: DoorToDoorLayout,
});

const TABS = [
  { to: "/door-to-door/world", label: "Enter World", icon: DoorOpen },
  { to: "/door-to-door/dispositions", label: "Dispositions", icon: ListChecks },
] as const;

function DoorToDoorLayout() {
  const location = useLocation();
  const isWorld = location.pathname.startsWith("/door-to-door/world");

  return (
    <div className={cn("relative", isWorld ? "" : "space-y-5")}>
      {/* Floating tab pill — visible on both sub-tabs */}
      <nav
        className={cn(
          "z-[60] flex gap-1 rounded-xl border p-1 shadow-lg",
          isWorld
            ? "fixed top-4 left-1/2 -translate-x-1/2 backdrop-blur-md"
            : "sticky top-0",
        )}
        style={{
          borderColor: "var(--border)",
          backgroundColor: isWorld ? "rgba(10,10,11,0.85)" : "var(--bg-card)",
        }}
      >
        {TABS.map((t) => {
          const active = location.pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[var(--bg-hover)] text-foreground"
                  : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
