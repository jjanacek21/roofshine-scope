import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Sparkles, Loader2, Phone, MapPin, Calendar, Tag } from "lucide-react";
import { RKStatusBadge } from "./StatusBadge";
import { TicketInvoicePanel } from "./TicketInvoicePanel";
import { RK_STATUSES, RK_STATUS_COLORS, RK_STATUS_LABELS } from "@/lib/roofking/types";
import type { RKTicket, RKMaterial, RKLabor, RKStatus, RKAccount, RKProperty } from "@/lib/roofking/types";

export function TicketDrawer({
  ticketId,
  accounts,
  properties,
  onClose,
}: {
  ticketId: string | null;
  accounts: RKAccount[];
  properties: RKProperty[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: ticket } = useQuery({
    queryKey: ["rk", "ticket", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rk_tickets")
        .select("*")
        .eq("id", ticketId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RKTicket | null;
    },
  });

  const [rawNotes, setRawNotes] = useState("");
  const [polished, setPolished] = useState<string | null>(null);
  const [price, setPrice] = useState<string>("");
  const [materials, setMaterials] = useState<RKMaterial[]>([]);
  const [labor, setLabor] = useState<RKLabor[]>([]);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (ticket) {
      setRawNotes(ticket.field_notes_raw ?? "");
      setPolished(ticket.report_polished ?? null);
      setPrice(ticket.price != null ? String(ticket.price) : "");
      setMaterials(ticket.materials ?? []);
      setLabor(ticket.labor ?? []);
      setShowRaw(false);
    }
  }, [ticket]);

  const property = ticket ? properties.find((p) => p.id === ticket.property_id) : undefined;
  const account = ticket ? accounts.find((a) => a.id === ticket.account_id) : undefined;

  const update = useMutation({
    mutationFn: async (patch: Partial<RKTicket>) => {
      if (!ticket) return;
      const { error } = await supabase.from("rk_tickets").update(patch as never).eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rk", "tickets"] });
      qc.invalidateQueries({ queryKey: ["rk", "ticket", ticketId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const polish = useMutation({
    mutationFn: async () => {
      if (!ticket) throw new Error("no ticket");
      // Save the latest raw notes first
      await supabase.from("rk_tickets").update({ field_notes_raw: rawNotes }).eq("id", ticket.id);
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const r = await fetch("/api/rk-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "polish",
          payload: {
            ticket_id: ticket.id,
            customer: account?.name,
            roof_type: ticket.roof_type,
            reported_concern: ticket.reported_concern,
            raw_notes: rawNotes,
          },
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "AI failed");
      }
      const j = (await r.json()) as { text: string };
      return j.text;
    },
    onSuccess: (text) => {
      setPolished(text);
      qc.invalidateQueries({ queryKey: ["rk", "tickets"] });
      qc.invalidateQueries({ queryKey: ["rk", "ticket", ticketId] });
      toast.success("Notes polished · moved to Ready for Invoice");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI polish failed"),
  });

  if (!ticketId) return null;

  return (
    <div data-rk className="fixed inset-0 z-[90]" style={{ background: "rgba(5,7,12,0.55)" }} onClick={onClose}>
      <aside
        className="rk-drawer fixed inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l"
        style={{ background: "var(--rk-bg)", borderColor: "var(--rk-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {!ticket ? (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--rk-ink-muted)" }}>Loading…</div>
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="rk-num text-xs uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>
                    WO-{ticket.wo_number ?? "—"}
                  </span>
                  <RKStatusBadge status={ticket.status} />
                </div>
                <h2 className="rk-display mt-1 text-2xl">{account?.name ?? "Customer"}</h2>
                <p className="text-sm" style={{ color: "var(--rk-ink-muted)" }}>
                  {property?.name}
                </p>
              </div>
              <button onClick={onClose} className="rounded p-1 hover:bg-[var(--rk-panel-2)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Property block */}
            <div className="rk-card rk-panel-2 mb-5 grid grid-cols-2 gap-3 p-4 text-[13px]">
              <Info icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={[property?.address, property?.city && `${property?.city}${property?.state ? `, ${property.state}` : ""}${property?.zip ? ` ${property.zip}` : ""}`].filter(Boolean).join(" · ") || "—"} />
              <Info icon={<Phone className="h-3.5 w-3.5" />} label="Contact" value={[ticket.contact, ticket.phone].filter(Boolean).join(" · ") || "—"} />
              <Info icon={<Tag className="h-3.5 w-3.5" />} label="Roof Type" value={ticket.roof_type ?? "—"} />
              <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Service Date" value={ticket.service_date ?? "—"} />
              {ticket.purpose?.length > 0 && (
                <div className="col-span-2">
                  <span className="rk-label mb-1.5 block">Purpose</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ticket.purpose.map((p) => (
                      <span key={p} className="rk-status-pill" style={{ color: "var(--rk-accent-light)", background: "rgba(47,129,247,0.16)" }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reported Concern */}
            <Section title="Reported Concern">
              <p className="text-sm" style={{ color: "var(--rk-ink)" }}>
                {ticket.reported_concern ?? <span style={{ color: "var(--rk-ink-faint)" }}>None reported.</span>}
              </p>
            </Section>

            {/* Field notes + AI Polish */}
            <Section
              title="Field Notes / Work Performed"
              right={
                <button
                  onClick={() => polish.mutate()}
                  disabled={polish.isPending || !rawNotes.trim()}
                  className="rk-btn rk-btn-gold"
                >
                  {polish.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {polish.isPending ? "Polishing…" : "AI Polish"}
                </button>
              }
            >
              {polished ? (
                <div className="space-y-3">
                  <div className="rk-card rk-panel-2 whitespace-pre-wrap p-4 text-sm leading-relaxed">{polished}</div>
                  <button onClick={() => setShowRaw((s) => !s)} className="text-xs underline" style={{ color: "var(--rk-ink-muted)" }}>
                    {showRaw ? "Hide" : "Show"} raw crew notes
                  </button>
                  {showRaw && (
                    <textarea
                      className="rk-input"
                      rows={6}
                      value={rawNotes}
                      onChange={(e) => setRawNotes(e.target.value)}
                      onBlur={() => update.mutate({ field_notes_raw: rawNotes })}
                    />
                  )}
                </div>
              ) : (
                <textarea
                  className="rk-input"
                  rows={6}
                  placeholder="Type or paste the crew's raw notes here, then click AI Polish."
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                  onBlur={() => update.mutate({ field_notes_raw: rawNotes })}
                />
              )}
            </Section>

            {/* Materials */}
            <Section
              title="Materials"
              right={
                <button
                  onClick={() => {
                    const next = [...materials, { desc: "", qty: 1, cost: 0 }];
                    setMaterials(next);
                    update.mutate({ materials: next });
                  }}
                  className="rk-btn rk-btn-ghost"
                >+ Row</button>
              }
            >
              {materials.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--rk-ink-faint)" }}>No materials recorded.</p>
              ) : (
                <div className="space-y-2">
                  {materials.map((m, i) => (
                    <div key={i} className="grid grid-cols-[1fr_70px_90px_30px] gap-2">
                      <input className="rk-input" placeholder="Description" value={m.desc} onChange={(e) => {
                        const n = [...materials]; n[i] = { ...m, desc: e.target.value }; setMaterials(n);
                      }} onBlur={() => update.mutate({ materials })} />
                      <input className="rk-input rk-num" type="number" value={m.qty} onChange={(e) => {
                        const n = [...materials]; n[i] = { ...m, qty: Number(e.target.value) || 0 }; setMaterials(n);
                      }} onBlur={() => update.mutate({ materials })} />
                      <input className="rk-input rk-num" type="number" value={m.cost} onChange={(e) => {
                        const n = [...materials]; n[i] = { ...m, cost: Number(e.target.value) || 0 }; setMaterials(n);
                      }} onBlur={() => update.mutate({ materials })} />
                      <button onClick={() => {
                        const n = materials.filter((_, j) => j !== i); setMaterials(n); update.mutate({ materials: n });
                      }} className="text-[var(--rk-red)]"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Labor */}
            <Section
              title="Labor"
              right={
                <button
                  onClick={() => {
                    const next = [...labor, { name: "", total: 0 }];
                    setLabor(next); update.mutate({ labor: next });
                  }}
                  className="rk-btn rk-btn-ghost"
                >+ Row</button>
              }
            >
              {labor.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--rk-ink-faint)" }}>No labor recorded.</p>
              ) : (
                <div className="space-y-2">
                  {labor.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_30px] gap-2">
                      <input className="rk-input" placeholder="Tech name" value={l.name} onChange={(e) => {
                        const n = [...labor]; n[i] = { ...l, name: e.target.value }; setLabor(n);
                      }} onBlur={() => update.mutate({ labor })} />
                      <input className="rk-input rk-num" type="number" placeholder="hrs" value={l.total} onChange={(e) => {
                        const n = [...labor]; n[i] = { ...l, total: Number(e.target.value) || 0 }; setLabor(n);
                      }} onBlur={() => update.mutate({ labor })} />
                      <button onClick={() => {
                        const n = labor.filter((_, j) => j !== i); setLabor(n); update.mutate({ labor: n });
                      }} className="text-[var(--rk-red)]"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Invoice */}
            <TicketInvoicePanel ticket={ticket} account={account} property={property} />

            {/* Price */}
            <Section title="Pricing">
              <div className="flex items-center gap-3">
                <span className="rk-num text-lg" style={{ color: "var(--rk-gold)" }}>$</span>
                <input
                  className="rk-input rk-num max-w-[180px]"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onBlur={() => update.mutate({ price: price === "" ? null : Number(price) })}
                  placeholder="0.00"
                />
              </div>
            </Section>

            {/* Status stepper */}
            <div className="rk-divider my-5" />
            <div>
              <span className="rk-label mb-2 block">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {RK_STATUSES.map((s: RKStatus) => {
                  const c = RK_STATUS_COLORS[s];
                  const active = ticket.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => update.mutate({ status: s })}
                      className="rk-btn"
                      style={{
                        padding: "6px 11px",
                        fontSize: 12,
                        background: active ? c + "26" : "var(--rk-panel-2)",
                        color: active ? c : "var(--rk-ink-muted)",
                        borderColor: active ? c : "var(--rk-line)",
                      }}
                    >
                      {RK_STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="rk-display text-sm uppercase tracking-wider" style={{ color: "var(--rk-ink-muted)" }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <span className="rk-label mb-1 flex items-center gap-1.5">{icon}{label}</span>
      <p className="text-sm" style={{ color: "var(--rk-ink)" }}>{value}</p>
    </div>
  );
}
