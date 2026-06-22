import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, FileText, Sparkles, Plus, Trash2, Save } from "lucide-react";
import type { RKAccount, RKInvoice, RKInvoiceLine, RKProperty, RKTicket } from "@/lib/roofking/types";
import { useCompany } from "@/hooks/useCompany";
import { downloadRKInvoicePdf } from "@/lib/roofking/invoice-pdf";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(d: string, days: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function buildSmartInvoice(
  ticket: RKTicket,
  account: RKAccount | undefined,
  property: RKProperty | undefined,
): RKInvoice {
  const propAddress = [property?.address, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(", ");
  const lines: RKInvoiceLine[] = [];
  // Materials → line items
  (ticket.materials ?? []).forEach((m) => {
    if (!m?.desc && !m?.qty && !m?.cost) return;
    lines.push({ desc: m.desc || "Material", qty: m.qty || 1, price: m.cost || 0 });
  });
  // Labor → one rolled-up line per tech
  (ticket.labor ?? []).forEach((l) => {
    if (!l?.name && !l?.total) return;
    lines.push({ desc: `Labor — ${l.name || "Tech"}`, qty: l.total || 0, price: 0, notes: "Hourly" });
  });
  // Fallback service line if empty
  if (lines.length === 0) {
    lines.push({
      desc: ticket.report_polished?.slice(0, 80) || ticket.reported_concern?.slice(0, 80) || "Service call",
      qty: 1,
      price: ticket.price ?? 0,
    });
  }
  const today = todayISO();
  return {
    invoice_number: `RK-${ticket.wo_number ?? "DRAFT"}`,
    issue_date: today,
    due_date: addDaysISO(today, 30),
    bill_to: {
      name: account?.name ?? "",
      contact: ticket.contact ?? account?.primary_contact ?? "",
      phone: ticket.phone ?? account?.phone ?? "",
      email: account?.email ?? "",
      address: account?.city ?? "",
    },
    property: { name: property?.name ?? "", address: propAddress },
    description: ticket.report_polished || ticket.reported_concern || "",
    lines,
    tax_pct: 0,
    notes: "",
  };
}

export function TicketInvoicePanel({
  ticket,
  account,
  property,
}: {
  ticket: RKTicket;
  account: RKAccount | undefined;
  property: RKProperty | undefined;
}) {
  const qc = useQueryClient();
  const { data: company } = useCompany();
  const [inv, setInv] = useState<RKInvoice | null>(ticket.invoice ?? null);
  const [open, setOpen] = useState<boolean>(!!ticket.invoice);

  useEffect(() => {
    setInv(ticket.invoice ?? null);
    setOpen(!!ticket.invoice);
  }, [ticket.id, ticket.invoice]);

  const totals = useMemo(() => {
    if (!inv) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = inv.lines.reduce((s, l) => s + (l.qty || 0) * (l.price || 0), 0);
    const tax = subtotal * ((inv.tax_pct || 0) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }, [inv]);

  const save = useMutation({
    mutationFn: async (next: RKInvoice) => {
      const { error } = await supabase
        .from("rk_tickets")
        .update({ invoice: next as never })
        .eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rk", "ticket", ticket.id] });
      qc.invalidateQueries({ queryKey: ["rk", "tickets"] });
      toast.success("Invoice saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function createDraft() {
    const draft = buildSmartInvoice(ticket, account, property);
    setInv(draft);
    setOpen(true);
    save.mutate(draft);
  }

  function patch(p: Partial<RKInvoice>) {
    if (!inv) return;
    setInv({ ...inv, ...p });
  }
  function patchLine(i: number, p: Partial<RKInvoiceLine>) {
    if (!inv) return;
    const lines = inv.lines.map((l, j) => (j === i ? { ...l, ...p } : l));
    setInv({ ...inv, lines });
  }
  function addLine() {
    if (!inv) return;
    setInv({ ...inv, lines: [...inv.lines, { desc: "", qty: 1, price: 0 }] });
  }
  function removeLine(i: number) {
    if (!inv) return;
    setInv({ ...inv, lines: inv.lines.filter((_, j) => j !== i) });
  }
  function refillSmart() {
    if (!inv) return;
    const fresh = buildSmartInvoice(ticket, account, property);
    setInv({ ...inv, bill_to: fresh.bill_to, property: fresh.property, description: fresh.description });
  }
  function download() {
    if (!inv) return;
    downloadRKInvoicePdf(
      inv,
      {
        name: "Roof King",
        phone: "954-782-3002",
        email: company?.email ?? null,
        website: company?.website ?? null,
        address: "1913 NW 18th St. Suite 2",
        cityStateZip: "Pompano Beach, FL 33069",
      },
      ticket.wo_number,
    );
  }

  if (!inv) {
    return (
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="rk-display text-sm uppercase tracking-wider" style={{ color: "var(--rk-ink-muted)" }}>
            Invoice
          </h3>
        </div>
        <button onClick={createDraft} className="rk-btn rk-btn-primary w-full justify-center">
          <FileText className="h-3.5 w-3.5" />
          Create invoice from this ticket
        </button>
        <p className="mt-2 text-xs" style={{ color: "var(--rk-ink-faint)" }}>
          Smart-fills contact, property, and work description from the ticket. Edit lines and download a PDF.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="rk-display text-sm uppercase tracking-wider" style={{ color: "var(--rk-ink-muted)" }}>
          Invoice <span className="rk-num" style={{ color: "var(--rk-ink-faint)" }}>#{inv.invoice_number}</span>
        </h3>
        <div className="flex gap-1.5">
          <button onClick={() => setOpen((o) => !o)} className="rk-btn rk-btn-ghost">{open ? "Collapse" : "Expand"}</button>
          <button onClick={() => save.mutate(inv)} className="rk-btn rk-btn-ghost"><Save className="h-3.5 w-3.5" />Save</button>
          <button onClick={download} className="rk-btn rk-btn-gold"><Download className="h-3.5 w-3.5" />PDF</button>
        </div>
      </div>

      {open && (
        <div className="rk-card rk-panel-2 space-y-4 p-4">
          {/* Smart-filled header */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice #" value={inv.invoice_number} onChange={(v) => patch({ invoice_number: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Issued" type="date" value={inv.issue_date} onChange={(v) => patch({ issue_date: v })} />
              <Field label="Due" type="date" value={inv.due_date} onChange={(v) => patch({ due_date: v })} />
            </div>
          </div>

          <div className="rk-divider" />

          <div className="flex items-center justify-between">
            <span className="rk-label">Smart Fields</span>
            <button onClick={refillSmart} className="rk-btn rk-btn-ghost text-xs"><Sparkles className="h-3 w-3" />Refill from ticket</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Bill to · Name" value={inv.bill_to.name} onChange={(v) => patch({ bill_to: { ...inv.bill_to, name: v } })} />
            <Field label="Bill to · Contact" value={inv.bill_to.contact} onChange={(v) => patch({ bill_to: { ...inv.bill_to, contact: v } })} />
            <Field label="Phone" value={inv.bill_to.phone} onChange={(v) => patch({ bill_to: { ...inv.bill_to, phone: v } })} />
            <Field label="Email" value={inv.bill_to.email} onChange={(v) => patch({ bill_to: { ...inv.bill_to, email: v } })} />
            <Field label="Property" value={inv.property.name} onChange={(v) => patch({ property: { ...inv.property, name: v } })} />
            <Field label="Property address" value={inv.property.address} onChange={(v) => patch({ property: { ...inv.property, address: v } })} />
          </div>

          <div>
            <span className="rk-label mb-1 block">Work description</span>
            <textarea
              className="rk-input"
              rows={3}
              value={inv.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </div>

          <div className="rk-divider" />

          {/* Line items */}
          <div className="flex items-center justify-between">
            <span className="rk-label">Line items</span>
            <button onClick={addLine} className="rk-btn rk-btn-ghost text-xs"><Plus className="h-3 w-3" />Add line</button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_64px_84px_84px_28px] gap-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>
              <span>Description / Notes</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Amount</span>
              <span></span>
            </div>
            {inv.lines.map((l, i) => {
              const amount = (l.qty || 0) * (l.price || 0);
              return (
                <div key={i} className="grid grid-cols-[1fr_64px_84px_84px_28px] gap-2">
                  <div className="space-y-1">
                    <input
                      className="rk-input"
                      placeholder="Description"
                      value={l.desc}
                      onChange={(e) => patchLine(i, { desc: e.target.value })}
                    />
                    <input
                      className="rk-input text-xs"
                      placeholder="Notes (optional)"
                      value={l.notes ?? ""}
                      onChange={(e) => patchLine(i, { notes: e.target.value })}
                    />
                  </div>
                  <input
                    className="rk-input rk-num text-right"
                    type="number"
                    value={l.qty}
                    onChange={(e) => patchLine(i, { qty: Number(e.target.value) || 0 })}
                  />
                  <input
                    className="rk-input rk-num text-right"
                    type="number"
                    value={l.price}
                    onChange={(e) => patchLine(i, { price: Number(e.target.value) || 0 })}
                  />
                  <div className="flex items-center justify-end rk-num text-sm" style={{ color: "var(--rk-ink)" }}>
                    ${amount.toFixed(2)}
                  </div>
                  <button onClick={() => removeLine(i)} className="text-[var(--rk-red)]"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>

          <div className="rk-divider" />

          {/* Totals */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="rk-label mb-1 block">Invoice notes</span>
              <textarea
                className="rk-input"
                rows={3}
                placeholder="Payment terms, thank-you note, etc."
                value={inv.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={`$${totals.subtotal.toFixed(2)}`} />
              <div className="grid grid-cols-[1fr_70px] items-center gap-2">
                <span style={{ color: "var(--rk-ink-muted)" }}>Tax %</span>
                <input
                  className="rk-input rk-num text-right"
                  type="number"
                  value={inv.tax_pct}
                  onChange={(e) => patch({ tax_pct: Number(e.target.value) || 0 })}
                />
              </div>
              <Row label="Tax" value={`$${totals.tax.toFixed(2)}`} />
              <div className="rk-divider" />
              <Row label="Total" value={`$${totals.total.toFixed(2)}`} bold />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <span className="rk-label mb-1 block">{label}</span>
      <input className="rk-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: bold ? "var(--rk-ink)" : "var(--rk-ink-muted)" }} className={bold ? "rk-display" : ""}>{label}</span>
      <span className={`rk-num ${bold ? "text-lg" : ""}`} style={{ color: bold ? "var(--rk-gold)" : "var(--rk-ink)" }}>{value}</span>
    </div>
  );
}
