import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { RKAccount, RKProperty, RKTicket } from "@/lib/roofking/types";
import { RK_PURPOSES } from "@/lib/roofking/types";

export function NewTicketDialog({
  companyId,
  accounts,
  properties,
  tickets,
  open,
  onClose,
  onCreated,
  defaultPropertyId,
}: {
  companyId: string;
  accounts: RKAccount[];
  properties: RKProperty[];
  tickets: RKTicket[];
  open: boolean;
  onClose: () => void;
  onCreated?: (t: RKTicket) => void;
  defaultPropertyId?: string;
}) {
  const qc = useQueryClient();
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId ?? "");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [roofType, setRoofType] = useState("");
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState<string[]>([]);
  const [concern, setConcern] = useState("");

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Auto-fill from latest ticket on that property → fallback to account
  useEffect(() => {
    if (!propertyId) return;
    const prop = properties.find((p) => p.id === propertyId);
    const propTickets = tickets
      .filter((t) => t.property_id === propertyId)
      .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1));
    const latest = propTickets[0];
    const acct = prop ? accountById.get(prop.account_id) : undefined;
    setContact(latest?.contact ?? acct?.primary_contact ?? "");
    setPhone(latest?.phone ?? acct?.phone ?? "");
    setRoofType(latest?.roof_type ?? prop?.roof_type ?? "");
  }, [propertyId, properties, tickets, accountById]);

  useEffect(() => {
    if (open && defaultPropertyId) setPropertyId(defaultPropertyId);
  }, [open, defaultPropertyId]);

  const create = useMutation({
    mutationFn: async () => {
      const prop = properties.find((p) => p.id === propertyId);
      if (!prop) throw new Error("Pick a building");

      const { data: woRpc, error: woErr } = await supabase.rpc("rk_next_wo", { _company_id: companyId });
      if (woErr) throw woErr;
      const wo = typeof woRpc === "number" ? woRpc : Number(woRpc) || 1001;

      const { data, error } = await supabase
        .from("rk_tickets")
        .insert({
          company_id: companyId,
          property_id: prop.id,
          account_id: prop.account_id,
          wo_number: wo,
          contact: contact.trim() || null,
          phone: phone.trim() || null,
          roof_type: roofType || null,
          service_date: serviceDate || null,
          status: "new",
          purpose,
          reported_concern: concern.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as RKTicket;
    },
    onSuccess: (t) => {
      toast.success(`Ticket WO-${t.wo_number} created`);
      qc.invalidateQueries({ queryKey: ["rk", "tickets"] });
      onCreated?.(t);
      setContact(""); setPhone(""); setRoofType(""); setPurpose([]); setConcern("");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!open) return null;

  // Group properties by account
  const groups = new Map<string, RKProperty[]>();
  for (const p of properties) {
    const arr = groups.get(p.account_id) ?? [];
    arr.push(p);
    groups.set(p.account_id, arr);
  }

  return (
    <div data-rk className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(5,7,12,0.7)" }} onClick={onClose}>
      <div className="rk-card w-full max-w-xl p-5 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="rk-display text-lg">New Service Ticket</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--rk-panel-2)]"><X className="h-4 w-4" /></button>
        </div>

        {properties.length === 0 ? (
          <div className="rk-panel-2 rounded-lg p-6 text-center text-sm" style={{ color: "var(--rk-ink-muted)" }}>
            Add a customer and a building first.
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="rk-label mb-1.5 block">Building *</span>
              <select className="rk-input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">— Select a building —</option>
                {[...groups.entries()].map(([accId, props]) => (
                  <optgroup key={accId} label={accountById.get(accId)?.name ?? "Customer"}>
                    {props.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.address ? ` · ${p.address}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact"><input className="rk-input" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
              <Field label="Phone"><input className="rk-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Roof Type">
                <select className="rk-input" value={roofType} onChange={(e) => setRoofType(e.target.value)}>
                  <option value="">—</option>
                  {["TPO","Modified Bitumen","Built-Up","Shingle","Metal","EPDM","Tile","Other"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Service Date"><input type="date" className="rk-input" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} /></Field>
            </div>

            <div>
              <span className="rk-label mb-1.5 block">Purpose</span>
              <div className="flex flex-wrap gap-1.5">
                {RK_PURPOSES.map((p) => {
                  const active = purpose.includes(p);
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setPurpose(active ? purpose.filter((x) => x !== p) : [...purpose, p])}
                      className="rk-btn"
                      style={{
                        padding: "5px 11px",
                        fontSize: 12,
                        background: active ? "var(--rk-accent)" : "var(--rk-panel-2)",
                        color: active ? "#fff" : "var(--rk-ink-muted)",
                        borderColor: active ? "var(--rk-accent)" : "var(--rk-line)",
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Reported Concern">
              <textarea
                className="rk-input"
                rows={3}
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                placeholder="What did the customer report?"
              />
            </Field>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rk-btn rk-btn-ghost">Cancel</button>
          <button
            disabled={!propertyId || create.isPending}
            onClick={() => create.mutate()}
            className="rk-btn rk-btn-primary"
          >{create.isPending ? "Creating…" : "Create Ticket"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="rk-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
