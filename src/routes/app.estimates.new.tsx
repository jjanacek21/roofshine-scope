import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/estimates/new")({
  head: () => ({ meta: [{ title: "New estimate · GCN Estimator" }] }),
  component: NewEstimate,
});

const schema = z.object({
  customer_name: z.string().trim().min(1, "Customer name is required").max(120),
  customer_email: z.string().trim().email("Invalid email").max(255).or(z.literal("")),
  customer_phone: z.string().trim().max(40).optional(),
  project_address: z.string().trim().min(1, "Project address is required").max(255),
  roof_sqft: z.coerce.number().min(0).max(1000000),
  roof_pitch: z.string().trim().max(20).optional(),
  status: z.enum(["draft", "sent", "approved", "rejected"]),
});

function NewEstimate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    project_address: "",
    roof_sqft: "",
    roof_pitch: "",
    status: "draft" as "draft" | "sent" | "approved" | "rejected",
  });

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parse = schema.safeParse({ ...form, roof_sqft: form.roof_sqft || 0 });
    if (!parse.success) return toast.error(parse.error.issues[0].message);

    setBusy(true);
    const { error } = await supabase.from("estimates").insert({
      user_id: user.id,
      customer_name: parse.data.customer_name,
      customer_email: parse.data.customer_email || null,
      customer_phone: parse.data.customer_phone || null,
      project_address: parse.data.project_address,
      roof_sqft: parse.data.roof_sqft,
      roof_pitch: parse.data.roof_pitch || null,
      status: parse.data.status,
      total: 0,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Estimate created");
    navigate({ to: "/app/estimates" });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/app/estimates" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to estimates
      </Link>

      <div className="mt-4">
        <h1 className="text-3xl font-bold tracking-tight">New estimate</h1>
        <p className="mt-1 text-sm text-muted-foreground">Capture the basics. You can refine line items and pricing later.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-8">
        <Section title="Customer" desc="Who is this estimate for?">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} required />
            </Field>
            <Field label="Phone">
              <Input type="tel" value={form.customer_phone} onChange={(e) => update("customer_phone", e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email">
                <Input type="email" value={form.customer_email} onChange={(e) => update("customer_email", e.target.value)} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Project" desc="Where is the job site?">
          <Field label="Project address" required>
            <Input value={form.project_address} onChange={(e) => update("project_address", e.target.value)} placeholder="123 Main St, Austin, TX 78701" required />
          </Field>
        </Section>

        <Section title="Roof details" desc="Rough measurements — refine later.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Roof area (sq ft)">
              <Input type="number" min="0" step="1" value={form.roof_sqft} onChange={(e) => update("roof_sqft", e.target.value)} placeholder="2400" />
            </Field>
            <Field label="Pitch">
              <Input value={form.roof_pitch} onChange={(e) => update("roof_pitch", e.target.value)} placeholder="6/12" />
            </Field>
          </div>
        </Section>

        <Section title="Status" desc="Track this estimate's progress.">
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <div className="flex justify-end gap-3 border-t border-border pt-6">
          <Link to="/app/estimates">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create estimate
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="mb-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}
