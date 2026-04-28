import { Link, useLocation } from "@tanstack/react-router";
import { Search, Plus, Bell } from "lucide-react";
import { toast } from "sonner";
import { MobileSidebarSheet } from "@/components/layout/MobileSidebarSheet";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/jobs": "Jobs",
  "/clients": "Clients",
  "/price-books": "Pricing",
  "/settings": "Settings",
};

export function Topbar() {
  const location = useLocation();

  // Match longest route prefix
  let current = "Dashboard";
  if (location.pathname !== "/") {
    const match = Object.keys(ROUTE_LABELS)
      .filter((p) => p !== "/" && location.pathname.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];
    if (match) current = ROUTE_LABELS[match];
    else if (location.pathname.startsWith("/jobs/")) current = "Job Detail";
  }

  return (
    <header
      className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b px-6 backdrop-blur-xl"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "rgba(10, 10, 11, 0.7)",
      }}
    >
      {/* Breadcrumb */}
      <div
        className="hidden text-[13px] font-medium sm:block"
        style={{ color: "var(--text-muted)" }}
      >
        Workspace
        <span className="mx-2" style={{ color: "var(--border-bright)" }}>
          /
        </span>
        <span className="text-foreground">{current}</span>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div
        className="hidden items-center gap-2 rounded-lg border px-3 py-1.5 sm:flex"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-card)",
          width: 280,
          color: "var(--text-muted)",
        }}
      >
        <Search className="h-4 w-4" />
        <input
          type="text"
          placeholder="Search…"
          className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-[var(--text-muted)]"
        />
        <kbd
          className="rounded border px-1.5 py-px font-mono text-[10px]"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg)",
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Bell */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: "var(--text-muted)" }}
        aria-label="Notifications"
        onClick={() => toast.info("No new notifications")}
      >
        <Bell className="h-4 w-4" />
      </button>

      {/* New Job */}
      <Link
        to="/jobs/new"
        className="btn-brand flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
        New Job
      </Link>
    </header>
  );
}
