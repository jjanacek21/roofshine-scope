import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/invoices/")({
  component: InvoicesListPage,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-zinc-200 text-zinc-500 line-through",
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

function InvoicesListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, customer_name, total, amount_paid, amount_due, issue_date, due_date, currency")
        .order("issue_date", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = invoices.filter((i) => {
    if (status !== "all" && i.status !== status) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      i.invoice_number.toLowerCase().includes(needle) ||
      (i.customer_name || "").toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, send, and collect payments.</p>
        </div>
        <button
          onClick={() => navigate({ to: "/invoices/new" })}
          className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice # or customer" className="pl-9" />
        </div>
        <div className="flex gap-1">
          {["all", "draft", "sent", "partial", "paid", "overdue", "void"].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                status === s ? "bg-primary text-primary-foreground" : "bg-[var(--surface)] text-muted-foreground hover:bg-[var(--surface-hover)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{invoices.length === 0 ? "No invoices yet." : "No matches."}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-semibold">Invoice</th>
                <th className="px-6 py-3 font-semibold">Customer</th>
                <th className="px-6 py-3 font-semibold">Issued</th>
                <th className="px-6 py-3 font-semibold">Due</th>
                <th className="px-6 py-3 font-semibold text-right">Total</th>
                <th className="px-6 py-3 font-semibold text-right">Balance</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  className="border-t cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => navigate({ to: "/invoices/$id", params: { id: i.id } })}
                >
                  <td className="px-6 py-3 font-mono-num font-semibold">
                    <Link to="/invoices/$id" params={{ id: i.id }} className="text-foreground hover:text-[var(--brand)]">
                      {i.invoice_number}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{i.customer_name || "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground text-xs">{format(new Date(i.issue_date), "MMM d, yyyy")}</td>
                  <td className="px-6 py-3 text-muted-foreground text-xs">
                    {i.due_date ? format(new Date(i.due_date), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-6 py-3 text-right font-mono-num">{money(i.total)}</td>
                  <td className="px-6 py-3 text-right font-mono-num font-semibold">{money(i.amount_due)}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_COLORS[i.status] || ""}`}>
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
