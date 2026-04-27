import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Building2, Megaphone, Mail, FileText, Brain, Star, CreditCard, Flag, BarChart3, LifeBuoy, ScrollText, ArrowLeft, Library, Ruler } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: typeof Shield; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: Shield, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
  { to: "/admin/price-books", label: "Pricing", icon: Library },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/emails", label: "Email Blasts", icon: Mail },
  { to: "/admin/content", label: "Home Page CMS", icon: FileText },
  { to: "/admin/training", label: "AI Training Center", icon: Brain },
  { to: "/admin/measurement-reviews", label: "Measurement Reviews", icon: Ruler },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/memberships", label: "Plans & Pricing", icon: CreditCard },
  { to: "/admin/features", label: "Feature Flags", icon: Flag },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/support", label: "Support", icon: LifeBuoy },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setState(data?.role === "super_admin" ? "ok" : "denied");
    })();
  }, [user, loading, navigate]);

  if (loading || state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Checking access…</div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <Shield className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">403 — Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have access to the platform admin portal.
          </p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] border-r border-border bg-card lg:block">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">Admin Portal</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">Super Admin</div>
          </div>
        </div>
        <nav className="px-2 pb-6">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact ?? false }}
                activeProps={{ className: "bg-accent text-foreground" }}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="mt-4 border-t border-border pt-4">
            <Link
              to="/"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to app
            </Link>
          </div>
        </nav>
      </aside>
      <main className="lg:pl-[240px]">
        <div className="px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
