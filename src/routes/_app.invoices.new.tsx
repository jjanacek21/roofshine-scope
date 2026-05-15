import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { createInvoice } from "@/lib/invoices.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Briefcase, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/invoices/new")({
  component: NewInvoicePage,
});

function NewInvoicePage() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const createFn = useServerFn(createInvoice);

  const [source, setSource] = useState<"blank" | "job" | "client">("blank");
  const [jobId, setJobId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [useContractPrice, setUseContractPrice] = useState(true);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", address: "" });
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment due within 14 days. Thank you for your business.");
  const [dueDays, setDueDays] = useState(14);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-for-invoice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, name, property_address, client_id, total_estimate, clients(id, name, email, phone, address)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-invoice"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, email, phone, address").order("name");
      return data ?? [];
    },
  });

  const { data: latestSnapshot } = useQuery({
    queryKey: ["job-latest-snapshot", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data } = await supabase
        .from("job_order_snapshots")
        .select("*")
        .eq("job_id", jobId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Auto-fill customer from job/client
  function pickJob(id: string) {
    setJobId(id);
    const job = jobs.find((j) => j.id === id);
    if (job) {
      const client = (job as any).clients;
      if (client) {
        setClientId(client.id);
        setCustomer({
          name: client.name || "",
          email: client.email || "",
          phone: client.phone || "",
          address: client.address || job.property_address || "",
        });
      } else if (job.property_address) {
        setCustomer((c) => ({ ...c, address: job.property_address }));
      }
    }
  }

  function pickClient(id: string) {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) setCustomer({ name: c.name || "", email: c.email || "", phone: c.phone || "", address: c.address || "" });
  }

  const create = useMutation({
    mutationFn: async () => {
      const lines: any[] = [];
      const job = jobs.find((j) => j.id === jobId);
      const totals = (latestSnapshot as any)?.totals as any;
      const contractTotal = totals?.total_with_tax ?? totals?.total ?? job?.total_estimate ?? 0;

      if (source === "job" && jobId && useContractPrice && contractTotal > 0) {
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
      dueDate.setDate(dueDate.getDate() + dueDays);

      const res = await createFn({
        data: {
          job_id: jobId || null,
          client_id: clientId || null,
          customer_name: customer.name || null,
          customer_email: customer.email || null,
          customer_phone: customer.phone || null,
          customer_address: customer.address || null,
          due_date: dueDate.toISOString().slice(0, 10),
          tax_pct: 0,
          discount: 0,
          notes: notes || null,
          terms: terms || null,
          line_items: lines,
        },
      });
      return res;
    },
    onSuccess: (res) => {
      toast.success("Invoice created");
      navigate({ to: "/invoices/$id", params: { id: res.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!profile) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/invoices" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-foreground">New Invoice</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start blank, from a job, or from a client.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { id: "blank", icon: FileText, label: "Blank invoice" },
          { id: "job", icon: Briefcase, label: "From a job" },
          { id: "client", icon: User, label: "From a client" },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSource(id as any)}
            className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all ${
              source === id ? "border-primary bg-primary/5" : "border-[var(--border)] hover:border-primary/40"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-sm font-semibold">{label}</span>
          </button>
        ))}
      </div>

      {source === "job" && (
        <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          <div>
            <Label>Pick a job</Label>
            <Select value={jobId} onValueChange={pickJob}>
              <SelectTrigger><SelectValue placeholder="Choose a job…" /></SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>{j.name} — {(j as any).clients?.name || "no client"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {jobId && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useContractPrice} onChange={(e) => setUseContractPrice(e.target.checked)} />
              Add a single line for the approved contract price
              {latestSnapshot && (
                <span className="font-mono-num text-muted-foreground">
                  ({((latestSnapshot as any).totals?.total_with_tax ?? (latestSnapshot as any).totals?.total ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" })})
                </span>
              )}
            </label>
          )}
        </div>
      )}

      {source === "client" && (
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          <Label>Pick a client</Label>
          <Select value={clientId} onValueChange={pickClient}>
            <SelectTrigger><SelectValue placeholder="Choose a client…" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Customer name</Label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></div>
        <div><Label>Due in (days)</Label><Input type="number" value={dueDays} onChange={(e) => setDueDays(Number(e.target.value))} /></div>
        <div className="sm:col-span-2"><Label>Address</Label><Textarea value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} rows={2} /></div>
        <div className="sm:col-span-2"><Label>Notes (visible to customer)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        <div className="sm:col-span-2"><Label>Terms</Label><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} /></div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>Cancel</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create & Edit"}
        </Button>
      </div>
    </div>
  );
}
