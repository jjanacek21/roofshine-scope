import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/estimates/")({
  head: () => ({ meta: [{ title: "Estimates · RoofScope Pro" }] }),
  component: EstimatesList,
});

interface Estimate {
  id: string;
  customer_name: string | null;
  project_address: string | null;
  status: string | null;
  total: number | null;
  created_at: string;
}

const statusVariants: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-accent text-accent-foreground" },
  approved: { label: "Approved", className: "bg-success/15 text-success" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
};

function EstimatesList() {
  const { user } = useAuth();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("id,customer_name,project_address,status,total,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) setError(error.message);
      else setEstimates((data as Estimate[]) ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estimates</h1>
          <p className="mt-1 text-sm text-muted-foreground">All your roofing estimates in one place.</p>
        </div>
        <Link to="/app/estimates/new">
          <Button className="gap-2"><Plus className="h-4 w-4" /> New estimate</Button>
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">Couldn't load estimates</h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">Make sure the <code className="rounded bg-muted px-1">estimates</code> table exists in your Supabase project.</p>
          </div>
        ) : estimates.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No estimates yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first estimate to get started.</p>
            <Link to="/app/estimates/new" className="mt-4 inline-block">
              <Button className="gap-2"><Plus className="h-4 w-4" /> New estimate</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Project</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {estimates.map((e) => {
                  const v = statusVariants[e.status ?? "draft"] ?? statusVariants.draft;
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium text-foreground">{e.customer_name ?? "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{e.project_address ?? "—"}</td>
                      <td className="px-6 py-4">
                        <Badge className={`${v.className} border-transparent font-medium`} variant="secondary">{v.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right font-medium tabular-nums">${(Number(e.total) || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
