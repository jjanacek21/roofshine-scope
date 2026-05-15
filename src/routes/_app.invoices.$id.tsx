import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { updateInvoice, voidInvoice, deleteInvoice } from "@/lib/invoices.functions";
import { setDefaultTemplate } from "@/lib/invoice-templates.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Send, Sparkles, Link as LinkIcon, DollarSign, Printer } from "lucide-react";
import { toast } from "sonner";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { RecordPaymentDialog } from "@/components/invoices/RecordPaymentDialog";
import { DesignWithAIDialog } from "@/components/invoices/DesignWithAIDialog";

export const Route = createFileRoute("/_app/invoices/$id")({
  component: EditInvoicePage,
});

type LineDraft = {
  id?: string;
  name: string;
  description: string;
  unit: string;
  qty: number;
  unit_price: number;
  kind: "custom" | "catalog";
  line_item_master_id?: string | null;
  sort_order: number;
};

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

function EditInvoicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const updateFn = useServerFn(updateInvoice);
  const voidFn = useServerFn(voidInvoice);
  const delFn = useServerFn(deleteInvoice);
  const setDefaultFn = useServerFn(setDefaultTemplate);

  const [recordOpen, setRecordOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const [{ data: invoice }, { data: lines }, { data: payments }, { data: templates }, { data: company }] = await Promise.all([
        supabase.from("invoices").select("*").eq("id", id).single(),
        supabase.from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order"),
        supabase.from("invoice_payments").select("*").eq("invoice_id", id).eq("status", "succeeded").order("paid_at"),
        supabase.from("invoice_templates").select("*").or("company_id.is.null,company_id.eq." + (await supabase.auth.getUser()).data.user?.id),
        supabase.from("companies").select("*").limit(1).maybeSingle(),
      ]);
      // fetch templates for this company too
      const { data: tplAll } = await supabase.from("invoice_templates").select("*").order("kind").order("name");
      return { invoice, lines: lines ?? [], payments: payments ?? [], templates: tplAll ?? [], company };
    },
  });

  const [draft, setDraft] = useState<LineDraft[]>([]);
  const [meta, setMeta] = useState({ tax_pct: 0, discount: 0, due_date: "", notes: "", terms: "", template_id: "", customer_name: "", customer_email: "", customer_phone: "", customer_address: "" });

  useEffect(() => {
    if (data?.invoice) {
      const inv = data.invoice as any;
      setMeta({
        tax_pct: Number(inv.tax_pct) || 0,
        discount: Number(inv.discount) || 0,
        due_date: inv.due_date || "",
        notes: inv.notes || "",
        terms: inv.terms || "",
        template_id: inv.template_id || data.templates.find((t: any) => t.is_default)?.id || data.templates[0]?.id || "",
        customer_name: inv.customer_name || "",
        customer_email: inv.customer_email || "",
        customer_phone: inv.customer_phone || "",
        customer_address: inv.customer_address || "",
      });
      setDraft(
        (data.lines as any[]).map((l, i) => ({
          id: l.id, name: l.name, description: l.description || "", unit: l.unit, qty: Number(l.qty),
          unit_price: Number(l.unit_price), kind: l.kind, line_item_master_id: l.line_item_master_id, sort_order: i,
        }))
      );
    }
  }, [data?.invoice?.id]);

  const saveMut = useMutation({
    mutationFn: () => updateFn({
      data: {
        id,
        patch: { ...meta, due_date: meta.due_date || null, template_id: meta.template_id || null },
        line_items: draft.map((l, i) => ({
          ...l,
          description: l.description || null,
          sort_order: i,
        })),
      },
    }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["invoice", id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const sendMut = useMutation({
    mutationFn: () => updateFn({ data: { id, patch: { status: "sent" as const } } }),
    onSuccess: () => { toast.success("Marked as sent"); qc.invalidateQueries({ queryKey: ["invoice", id] }); },
  });

  if (isLoading || !data?.invoice) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const inv = data.invoice as any;
  const subtotal = draft.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const tax = (subtotal - meta.discount) * (meta.tax_pct / 100);
  const total = subtotal - meta.discount + tax;
  const amountDue = total - Number(inv.amount_paid);

  const tpl = data.templates.find((t: any) => t.id === meta.template_id);

  function addLine() {
    setDraft([...draft, { name: "", description: "", unit: "EA", qty: 1, unit_price: 0, kind: "custom", sort_order: draft.length }]);
  }
  function removeLine(idx: number) { setDraft(draft.filter((_, i) => i !== idx)); }
  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setDraft(draft.map((l, i) => i === idx ? { ...l, ...patch } : l));
  }

  const payUrl = `${window.location.origin}/pay/${inv.public_pay_token}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/invoices" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(payUrl); toast.success("Pay link copied"); }}>
            <LinkIcon className="h-4 w-4 mr-1" /> Copy pay link
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(payUrl, "_blank")}>
            Preview public page
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRecordOpen(true)}>
            <DollarSign className="h-4 w-4 mr-1" /> Record payment
          </Button>
          {inv.status === "draft" && (
            <Button size="sm" onClick={() => sendMut.mutate()}>
              <Send className="h-4 w-4 mr-1" /> Mark sent
            </Button>
          )}
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold">{inv.invoice_number}</h1>
        <p className="text-sm text-muted-foreground capitalize">Status: {inv.status} · Total {money(Number(inv.total))} · Paid {money(Number(inv.amount_paid))} · Due {money(Number(inv.amount_due))}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-5">
          <section className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Customer</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={meta.customer_name} onChange={(e) => setMeta({ ...meta, customer_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={meta.customer_email} onChange={(e) => setMeta({ ...meta, customer_email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={meta.customer_phone} onChange={(e) => setMeta({ ...meta, customer_phone: e.target.value })} /></div>
              <div><Label>Due date</Label><Input type="date" value={meta.due_date} onChange={(e) => setMeta({ ...meta, due_date: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Address</Label><Textarea rows={2} value={meta.customer_address} onChange={(e) => setMeta({ ...meta, customer_address: e.target.value })} /></div>
            </div>
          </section>

          <section className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Line items</h3>
              <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add line</Button>
            </div>
            <div className="space-y-2">
              {draft.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <Input placeholder="Description" value={line.name} onChange={(e) => updateLine(i, { name: e.target.value })} />
                    <Input placeholder="Notes (optional)" value={line.description} onChange={(e) => updateLine(i, { description: e.target.value })} className="mt-1 text-xs" />
                  </div>
                  <Input className="col-span-1" type="number" value={line.qty} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} />
                  <Input className="col-span-1" placeholder="EA" value={line.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} />
                  <Input className="col-span-2" type="number" step="0.01" placeholder="Price" value={line.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} />
                  <div className="col-span-2 text-right font-mono-num text-sm pt-2">{money(line.qty * line.unit_price)}</div>
                  <button onClick={() => removeLine(i)} className="col-span-1 text-muted-foreground hover:text-destructive pt-2"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {draft.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No line items yet. Click <strong>Add line</strong>.</p>}
            </div>
          </section>

          <section className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Discount ($)</Label><Input type="number" step="0.01" value={meta.discount} onChange={(e) => setMeta({ ...meta, discount: Number(e.target.value) })} /></div>
              <div><Label>Tax %</Label><Input type="number" step="0.01" value={meta.tax_pct} onChange={(e) => setMeta({ ...meta, tax_pct: Number(e.target.value) })} /></div>
            </div>
            <div className="text-right space-y-1 text-sm font-mono-num">
              <div>Subtotal: {money(subtotal)}</div>
              <div>Tax: {money(tax)}</div>
              <div className="text-lg font-bold">Total: {money(total)}</div>
              <div className="text-muted-foreground">Balance due: {money(amountDue)}</div>
            </div>
          </section>

          <section className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Template</h3>
              <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}><Sparkles className="h-3 w-3 mr-1" /> Design with AI</Button>
            </div>
            <Select value={meta.template_id} onValueChange={(v) => setMeta({ ...meta, template_id: v })}>
              <SelectTrigger><SelectValue placeholder="Pick a template" /></SelectTrigger>
              <SelectContent>
                {data.templates.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} {t.kind === "ai" ? "✨" : ""} {t.is_default ? "· default" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tpl && !tpl.is_default && (
              <Button size="sm" variant="ghost" onClick={async () => { await setDefaultFn({ data: { template_id: tpl.id } }); toast.success("Set as default"); qc.invalidateQueries({ queryKey: ["invoice", id] }); }}>
                Set as default
              </Button>
            )}
          </section>

          <section className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
            <div><Label>Notes</Label><Textarea rows={2} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} /></div>
            <div><Label>Terms</Label><Textarea rows={2} value={meta.terms} onChange={(e) => setMeta({ ...meta, terms: e.target.value })} /></div>
          </section>

          {data.payments.length > 0 && (
            <section className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payments</h3>
              <ul className="text-sm space-y-1">
                {data.payments.map((p: any) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="capitalize text-muted-foreground">{p.method}{p.reference ? ` · ${p.reference}` : ""} · {new Date(p.paid_at).toLocaleDateString()}</span>
                    <span className="font-mono-num font-semibold">{money(Number(p.amount))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
              if (!confirm("Delete this invoice?")) return;
              await delFn({ data: { id } });
              toast.success("Deleted");
              navigate({ to: "/invoices" });
            }}>Delete</Button>
            {inv.status !== "void" && (
              <Button variant="outline" size="sm" onClick={async () => { await voidFn({ data: { id } }); qc.invalidateQueries({ queryKey: ["invoice", id] }); }}>Mark void</Button>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <InvoicePreview
            invoice={{ ...inv, ...meta, subtotal, tax, total, amount_due: amountDue }}
            lines={draft}
            company={data.company as any}
            layout={tpl?.layout as any}
          />
        </div>
      </div>

      <RecordPaymentDialog invoiceId={id} amountDue={amountDue} open={recordOpen} onOpenChange={setRecordOpen} />
      <DesignWithAIDialog open={aiOpen} onOpenChange={setAiOpen} onCreated={(tid) => setMeta({ ...meta, template_id: tid })} />
    </div>
  );
}
