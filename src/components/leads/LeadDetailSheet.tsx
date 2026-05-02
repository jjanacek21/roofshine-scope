import { useEffect, useRef, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useLead, useLeadContacts, useLeadActivities, useLeadNotes } from "@/hooks/useLeads";
import { LEAD_STATUSES, fmtMoney, fmtNum, type LeadStatus } from "@/lib/leads";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import mapboxgl from "mapbox-gl";
import { Phone, Mail, MessageSquare, Sparkles, FileText, Activity } from "lucide-react";
import { toast } from "sonner";
import { useCallPlaybook } from "@/hooks/useCallPlaybook";

interface Props {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDetailSheet({ leadId, onClose }: Props) {
  const { data: lead } = useLead(leadId);
  const { data: contacts = [] } = useLeadContacts(leadId);
  const { data: activities = [] } = useLeadActivities(leadId);
  const { data: notes = [] } = useLeadNotes(leadId);
  const { user } = useAuth();
  const { data: mapboxToken } = useMapboxToken();
  const qc = useQueryClient();
  const playbook = useCallPlaybook();
  const [noteText, setNoteText] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapboxToken || !mapRef.current || !lead?.lat || !lead?.lng) return;
    mapboxgl.accessToken = mapboxToken;
    const m = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [lead.lng, lead.lat],
      zoom: 18,
      interactive: false,
    });
    return () => m.remove();
  }, [mapboxToken, lead?.lat, lead?.lng]);

  const updateStatus = useMutation({
    mutationFn: async (status: LeadStatus) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", leadId!);
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: leadId!,
        user_id: user?.id,
        type: "status",
        note: `Status → ${status}`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!noteText.trim()) return;
      const { error } = await supabase.from("lead_notes").insert({
        lead_id: leadId!,
        user_id: user?.id,
        content: noteText.trim(),
      });
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: leadId!,
        user_id: user?.id,
        type: "note",
        note: noteText.trim().slice(0, 200),
      });
    },
    onSuccess: () => {
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["lead-notes", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      toast.success("Note added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function logQuickAction(type: "call" | "email" | "text") {
    if (!leadId) return;
    await supabase.from("lead_activities").insert({
      lead_id: leadId,
      user_id: user?.id,
      type,
      note: `${type} initiated`,
    });
    qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    if (type === "call" && lead) {
      playbook.openFor({
        id: lead.id,
        address: lead.address,
        city: lead.city,
        owner: lead.owner,
        sqft: lead.sqft,
        roof_type: lead.roof_type,
        year_built: lead.year_built,
      });
    }
  }

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
        {!lead ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-xl">{lead.address}</SheetTitle>
              <p className="text-sm text-muted-foreground">{lead.city}, {lead.state} {lead.zip}</p>
            </SheetHeader>

            <div className="mt-4 flex items-center justify-between gap-3">
              <select
                value={lead.status}
                onChange={(e) => updateStatus.mutate(e.target.value as LeadStatus)}
                className="rounded-md border bg-[var(--bg-elevated)] px-3 py-1.5 text-sm"
                style={{ borderColor: "var(--border)" }}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Value</div>
                <div className="font-mono-num text-lg font-bold text-foreground">{fmtMoney(lead.estimated_value)}</div>
              </div>
            </div>

            <Section title="Property Info">
              <Grid>
                <Field k="Owner" v={lead.owner ?? "—"} />
                <Field k="Type" v={lead.property_type ?? "—"} />
                <Field k="Sq Ft" v={fmtNum(lead.sqft)} />
                <Field k="Year Built" v={lead.year_built ?? "—"} />
                <Field k="Roof Type" v={lead.roof_type ?? "—"} />
                <Field k="Sale Amount" v={lead.sale_amount ?? "—"} />
              </Grid>
            </Section>

            <Section title="Contacts">
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts.</p>
              ) : (
                <ul className="space-y-3 divide-y" style={{ borderColor: "var(--border)" }}>
                  {contacts.map((c) => (
                    <li key={c.id} className="pt-3 first:pt-0">
                      <div className="font-medium text-foreground">{c.name}</div>
                      {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                      {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.phones?.map((p) => (
                          <a key={p.id} href={`tel:${p.phone}`} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#86efac" }}>
                            <Phone className="h-3 w-3" /> {p.phone}
                          </a>
                        ))}
                        {c.emails?.map((e) => (
                          <a key={e.id} href={`mailto:${e.email}`} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(30,144,255,0.15)", color: "#7dc3ff" }}>
                            <Mail className="h-3 w-3" /> {e.email}
                          </a>
                        ))}
                        {!c.phones?.length && !c.emails?.length && (
                          <span className="text-xs text-muted-foreground">No contact info</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Satellite View">
              {lead.lat != null && lead.lng != null && mapboxToken ? (
                <div ref={mapRef} className="h-48 w-full rounded-lg border" style={{ borderColor: "var(--border)" }} />
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                  No coordinates available
                </div>
              )}
            </Section>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <ActionBtn color="#22c55e" icon={<Phone className="h-3.5 w-3.5" />} label="Call" onClick={() => logQuickAction("call")} />
              <ActionBtn color="#3b82f6" icon={<Mail className="h-3.5 w-3.5" />} label="Email" onClick={() => logQuickAction("email")} />
              <ActionBtn color="#a855f7" icon={<MessageSquare className="h-3.5 w-3.5" />} label="Text" onClick={() => logQuickAction("text")} />
            </div>

            <Section title="Add Note">
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Type a note…" />
              <button onClick={() => addNote.mutate()} disabled={!noteText.trim() || addNote.isPending} className="btn-brand mt-2 h-9 w-full rounded-md text-sm font-semibold disabled:opacity-40">
                {addNote.isPending ? "Saving…" : "Save Note"}
              </button>
            </Section>

            {lead.ai_report && Object.keys(lead.ai_report).length > 0 && (lead.ai_report as { analysis?: string }).analysis && (
              <Section title="AI Analysis">
                <div className="rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)", whiteSpace: "pre-wrap" }}>
                  {(lead.ai_report as { analysis: string }).analysis}
                </div>
              </Section>
            )}

            <Section title="Activity">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="space-y-2">
                  {activities.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 text-xs">
                      <ActivityIcon type={a.type} />
                      <div className="flex-1">
                        <div className="text-foreground">{a.note ?? a.type}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {notes.length > 0 && (
              <Section title="Notes">
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-lg border p-2 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}>
                      <div className="text-foreground" style={{ whiteSpace: "pre-wrap" }}>{n.content}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}
function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-sm font-medium text-foreground">{v}</div>
    </div>
  );
}
function ActionBtn({ color, icon, label, onClick }: { color: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-semibold text-white" style={{ backgroundColor: color }}>
      {icon} {label}
    </button>
  );
}
function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, React.ReactNode> = {
    call: <Phone className="h-3.5 w-3.5 text-[#86efac]" />,
    email: <Mail className="h-3.5 w-3.5 text-[#7dc3ff]" />,
    text: <MessageSquare className="h-3.5 w-3.5 text-[#c4a5f7]" />,
    note: <FileText className="h-3.5 w-3.5 text-muted-foreground" />,
    status: <Activity className="h-3.5 w-3.5 text-[#fde047]" />,
    ai_analysis: <Sparkles className="h-3.5 w-3.5 text-[#7dc3ff]" />,
  };
  return <div className="mt-0.5">{map[type] ?? <Activity className="h-3.5 w-3.5" />}</div>;
}
