import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";
import { Users, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/team")({
  component: TeamLayout,
});

function TeamLayout() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;
    const role = profile?.role;
    const allowed = role === "owner" || role === "admin" || role === "super_admin";
    if (!allowed) {
      navigate({ to: "/" });
    }
  }, [profile, isLoading, navigate]);

  if (isLoading || !profile) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  const tabs = [
    { to: "/team", label: "Members", icon: Users, exact: true },
    { to: "/team/invites", label: "Invites", icon: Mail, exact: false },
  ];

  function isActive(to: string, exact: boolean) {
    return exact ? location.pathname === to : location.pathname.startsWith(to);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">
          Manage who has access to your company workspace.
        </p>
      </header>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.to, t.exact);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
                active
                  ? "border-[var(--brand)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
