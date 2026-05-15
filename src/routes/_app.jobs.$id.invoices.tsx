import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createInvoice } from "@/lib/invoices.functions";
import { Button } from "@/components/ui/button";
import { Plus, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/jobs/$id/invoices")({
  component: JobInvoicesPage,
});

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-500",
  sent: "bg-blue-500/10 text-blue-500",
  partial: "bg-amber-500/10 text-amber-500",
  paid: "bg-emerald-500/10 text-emerald-500",
  void: "bg-red-500/10 text-red-500",
  overdue: "bg-orange-500/10 text-orange-500",
};

function JobInvoicesPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createInvoice);

  const { data: job } = useQuery({
    queryKey: ["job-for-invoices", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, name, property_address, total_estimate, client_id, clients(id, name, email, phone, address)")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const { data: snapshot } = useQuery({
    queryKey: ["job-snapshot-for-invoices", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_order_snapshots")
        .select("totals")
        .eq("job_id", id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["job-invoices", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const totalInvoiced = invoices.reduce((s, inv: any) => s + Number(inv.total || 0), 0);
  const totalPaid = invoices.reduce((s, inv: any) => s + Number(inv.amount_paid || 0), 0);
  const totalDue = invoices.reduce((s, inv: any) => s + Number(inv.amount_due || 0), 0);

  const create = useMutation({
    mutationFn: async (opts: { useContractPrice: boolean }) => {
      const client = (job as any)?.clients;
      const totals = (snapshot as any)?.totals;
      const contractTotal = totals?.total_with_tax ?? totals?.total ?? job?.total_estimate ?? 0;

      const lines: any[] = [];
      if (opts.useContractPrice && contractTotal > 0) {
        lines.push({
          name: `Contract — ${job?.name || "Job"}`,
          description: job?.property_address || null,
          unit: "EA",
          qty: 1,
          unit_price: Number(contractTotal),
          kind: "custom" as const,
          sort_order: 0,
        });
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      return createFn({
        data: {
          job_id: id,
          client_id: client?.id ?? null,
          customer_name: client?.name ?? null,
          customer_email: client?.email ?? null,
          customer_phone: client?.phone ?? null,
          customer_address: client?.address ?? job?.property_address ?? null,
          due_date: dueDate.toISOString().slice(0, 10),
          tax_pct: 0,
          discount: 0,
          terms: "Payment due within 14 days. Thank you for your business.",
          line_items: lines,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Invoice created");
      qc.invalidateQueries({ queryKey: ["job-invoices", id] });
      navigate({ to: "/invoices/$id", params: { id: res.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const contractTotal =
    (snapshot as any)?.totals?.total_with_tax ??
    (snapshot as any)?.totals?.total ??
    job?.total_estimate ??
    0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Invoices</h2>
          <p className="text-sm text-muted-foreground">
            All invoices billed to this job. Take card, ACH, or record offline payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Number(contractTotal) > 0 && (
            <Button onClick={() => create.mutate({ useContractPrice: true })} disabled={create.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Bill contract price ({money(Number(contractTotal))})
            </Button>
          )}
          <Button variant="outline" onClick={() => create.mutate({ useContractPrice: false })} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Blank invoice
          </Button>
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Invoiced" value={money(totalInvoiced)} />
          <Stat label="Paid" value={money(totalPaid)} accent="emerald" />
          <Stat label="Outstanding" value={money(totalDue)} accent={totalDue > 0 ? "amber" : undefined} />
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : invoices.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed p-12 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 font-semibold">No invoices yet for this job</p>
          <p className="text-sm text-muted-foreground">
            Bill the contract price in one click, or build a custom invoice from line items.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-card)] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Number</th>
                <th className="text-left px-4 py-3">Issued</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Paid</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 font-mono-num">
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="hover:underline">
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.issue_date ? format(new Date(inv.issue_date), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${STATUS_STYLE[inv.status] || "bg-muted"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num">{money(Number(inv.total))}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-emerald-500">{money(Number(inv.amount_paid))}</td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold">{money(Number(inv.amount_due))}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/invoices/$id" params={{ id: inv.id }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      Open <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "amber" }) {
  const color = accent === "emerald" ? "text-emerald-500" : accent === "amber" ? "text-amber-500" : "text-foreground";
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`mt-1 text-2xl font-bold font-mono-num ${color}`}>{value}</div>
    </div>
  );
}
