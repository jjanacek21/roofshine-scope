import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, CheckCircle2, Clock, Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard · GCN Estimator" }] }),
  component: Dashboard,
});

interface Stats {
  total: number;
  draft: number;
  approved: number;
  totalValue: number;
}

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, approved: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("status,total")
        .eq("user_id", user.id);
      if (cancelled) return;
      if (error) {
        // table may not exist yet — show zeros silently
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      setStats({
        total: rows.length,
        draft: rows.filter((r: any) => r.status === "draft").length,
        approved: rows.filter((r: any) => r.status === "approved").length,
        totalValue: rows.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0),
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const cards = [
    { label: "Total estimates", value: stats.total, icon: FileText, tint: "text-primary bg-accent" },
    { label: "Draft", value: stats.draft, icon: Clock, tint: "text-warning-foreground bg-warning/20" },
    { label: "Approved", value: stats.approved, icon: CheckCircle2, tint: "text-success bg-success/15" },
    { label: "Pipeline value", value: `$${stats.totalValue.toLocaleString()}`, icon: DollarSign, tint: "text-primary bg-accent" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">An overview of your estimating activity.</p>
        </div>
        <Link to="/app/estimates/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New estimate
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.tint}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight">{loading ? "—" : c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Get started with your first estimate</h3>
        <p className="mt-1 text-sm text-muted-foreground">Capture a customer, enter roof details, and you're done.</p>
        <Link to="/app/estimates/new" className="mt-4 inline-block">
          <Button className="gap-2">
            Create estimate <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
