import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Megaphone, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const [stats, setStats] = useState({ companies: 0, users: 0, announcements: 0, audit: 0 });

  useEffect(() => {
    (async () => {
      const [c, u, a, l] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("announcements").select("id", { count: "exact", head: true }),
        supabase.from("audit_log").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        companies: c.count ?? 0,
        users: u.count ?? 0,
        announcements: a.count ?? 0,
        audit: l.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Companies", value: stats.companies, icon: Building2 },
    { label: "Users", value: stats.users, icon: Users },
    { label: "Announcements", value: stats.announcements, icon: Megaphone },
    { label: "Audit entries", value: stats.audit, icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">Cross-company stats and operational health.</p>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 font-mono text-2xl font-semibold">{c.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
