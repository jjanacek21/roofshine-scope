import { useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Map, List, Kanban, BookOpen, Send, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { CallPlaybookProvider } from "@/hooks/useCallPlaybook";
import { CallPlaybookPanel } from "@/components/leads/CallPlaybookPanel";
import { ReonomyImportDialog } from "@/components/commercial/ReonomyImportDialog";
import { useIsCompanyAdmin } from "@/hooks/useProfile";

export const Route = createFileRoute("/_app/leads")({
  component: LeadsLayout,
});

const TABS: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/leads", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/leads/map", label: "Map", icon: Map },
  { to: "/leads/list", label: "List", icon: List },
  { to: "/leads/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/leads/followup", label: "Follow-Up", icon: Send },
  { to: "/leads/training", label: "Training", icon: BookOpen },
];

function LeadsLayout() {
  const location = useLocation();
  const isAdmin = useIsCompanyAdmin();
  const [importOpen, setImportOpen] = useState(false);
  return (
    <CallPlaybookProvider>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prospecting</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Commercial roofing prospects · spray foam restoration
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setImportOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              <Upload className="h-4 w-4" />
              Import from Reonomy
            </button>
          )}
        </div>

        <nav
          className="flex gap-1 overflow-x-auto rounded-xl border p-1"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          {TABS.map((t) => {
            const active = t.exact
              ? location.pathname === t.to
              : location.pathname.startsWith(t.to);
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
      <CallPlaybookPanel />
      <ReonomyImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </CallPlaybookProvider>
  );
}
