import { useEffect, useRef, useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useLead, useLeadContacts, useLeadActivities, useLeadNotes } from "@/hooks/useLeads";
import { LEAD_STATUSES, fmtMoney, fmtNum, type LeadStatus } from "@/lib/leads";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import {
  Phone, Mail, MessageSquare, Sparkles, FileText, Activity, Loader2,
  BookOpen, Upload, Download, Trash2, Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { useCallPlaybook } from "@/hooks/useCallPlaybook";
import { RoofWizardInline } from "./RoofWizardInline";

interface Props {
  leadId: string | null;
  onClose: () => void;
}

export function LeadDetailSheet({ leadId, onClose }: Props) {
  const navigate = useNavigate();
  const { data: lead } = useLead(leadId);
  const { data: contacts = [] } = useLeadContacts(leadId);
  const { data: activities = [] } = useLeadActivities(leadId);
  const { data: notes = [] } = useLeadNotes(leadId);
  const { user } = useAuth();
  const { data: mapboxToken } = useMapboxToken();
  const qc = useQueryClient();
  const playbook = useCallPlaybook();
  const [noteText, setNoteText] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-geocode (client-side via Mapbox) when lead has no coords
  useEffect(() => {
    if (!lead || !leadId) return;
    if (lead.lat != null && lead.lng != null) return;
    if (!mapboxToken) return;
    if (geocoding || geocodeFailed) return;
    setGeocoding(true);
    const query = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
    (async () => {
      try {
        const r = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${mapboxToken}`,
        );
        if (!r.ok) throw new Error("geocode failed");
        const j = (await r.json()) as { features?: { center?: [number, number] }[] };
        const center = j.features?.[0]?.center;
        if (!center) {
          setGeocodeFailed(true);
          return;
        }
        const [lng, lat] = center;
        const { error } = await supabase.from("leads").update({ lat, lng }).eq("id", leadId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["lead", leadId] });
        qc.invalidateQueries({ queryKey: ["leads"] });
      } catch {
        setGeocodeFailed(true);
      } finally {
        setGeocoding(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, lead?.lat, lead?.lng, mapboxToken]);


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

  // ---- Reports & Documents lists ----
  const { data: reports = [] } = useQuery({
    queryKey: ["lead-reports", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_reports")
        .select("id, name, kind, pdf_path, created_at")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["lead-documents", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_documents")
        .select("id, name, kind, mime_type, size_bytes, storage_path, created_at")
        .eq("lead_id", leadId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function openSignedUrl(bucket: string, path: string, filename: string) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 5, { download: filename });
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function generateAndSaveReport() {
    if (!lead || !leadId) return;
    setGeneratingReport(true);
    try {
      const inputs = defaultsForLead(lead);
      const { doc, safeName } = buildSavingsReportPdf({ inputs, lead });
      const blob = doc.output("blob");
      const filename = `${safeName}-${Date.now()}.pdf`;
      const path = `${lead.company_id}/${leadId}/${filename}`;

      // Open the PDF in a new tab immediately so the user sees it
      const localUrl = URL.createObjectURL(blob);
      const win = window.open(localUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        // Popup blocked — fall back to downloading
        const a = document.createElement("a");
        a.href = localUrl;
        a.download = `${safeName}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(localUrl), 60_000);

      const { error: upErr } = await supabase.storage
        .from("lead-reports")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("lead_reports").insert([{
        lead_id: leadId,
        company_id: lead.company_id,
        created_by: user?.id,
        kind: "savings",
        name: `Savings Report — ${lead.address}`,
        pdf_path: path,
        inputs: inputs as unknown as never,
      }]);
      if (insErr) throw insErr;

      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        user_id: user?.id,
        type: "report_generated",
        note: `Savings report saved`,
      });

      qc.invalidateQueries({ queryKey: ["lead-reports", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      toast.success("Report opened and saved to lead");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save report");
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0 || !lead || !leadId) return;
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        errors.push(`${file.name}: exceeds 25 MB`);
        continue;
      }
      const safe = file.name.replace(/[^a-z0-9._-]+/gi, "-");
      const path = `${lead.company_id}/${leadId}/${Date.now()}-${safe}`;
      const kind = file.type.startsWith("image/") ? "photo" : "document";

      const { error: upErr } = await supabase.storage
        .from("lead-documents")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        errors.push(`${file.name}: ${upErr.message}`);
        continue;
      }

      const { error: insErr } = await supabase.from("lead_documents").insert({
        lead_id: leadId,
        company_id: lead.company_id,
        uploaded_by: user?.id,
        name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        storage_path: path,
        kind,
      });
      if (insErr) {
        errors.push(`${file.name}: ${insErr.message}`);
        // Best-effort cleanup of orphaned object
        await supabase.storage.from("lead-documents").remove([path]);
        continue;
      }

      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        user_id: user?.id,
        type: "document_uploaded",
        note: `${kind === "photo" ? "Photo" : "Document"}: ${file.name}`,
      });
    }
    qc.invalidateQueries({ queryKey: ["lead-documents", leadId] });
    qc.invalidateQueries({ queryKey: ["lead-activities", leadId] });
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (errors.length) toast.error(errors.join("; "));
    else toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded`);
  }

  async function deleteDocument(id: string, path: string) {
    if (!confirm("Delete this file?")) return;
    const { error } = await supabase.from("lead_documents").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from("lead-documents").remove([path]);
    qc.invalidateQueries({ queryKey: ["lead-documents", leadId] });
    toast.success("File deleted");
  }

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
      openPlaybook();
    }
  }

  function openPlaybook() {
    if (!lead) return;
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

            {/* Primary tools row — always visible */}
            <div className="mt-3">
              <button
                type="button"
                onClick={openPlaybook}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border text-xs font-semibold text-foreground transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
              >
                <BookOpen className="h-3.5 w-3.5 text-[var(--primary)]" />
                Open Playbook
              </button>
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
                <div ref={mapRef} className="h-48 w-full overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }} />
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                  {geocoding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Locating address…</span>
                    </>
                  ) : geocodeFailed ? (
                    <>
                      <span>Could not locate this address</span>
                      <button
                        type="button"
                        onClick={() => { setGeocodeFailed(false); }}
                        className="rounded-md border px-3 py-1 text-xs hover:bg-[var(--bg-hover)]"
                        style={{ borderColor: "var(--border)" }}
                      >
                        Try again
                      </button>
                    </>
                  ) : !mapboxToken ? (
                    <span>Loading map…</span>
                  ) : (
                    <span>No coordinates available</span>
                  )}
                </div>
              )}
            </Section>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (!leadId) return;
                  onClose();
                  navigate({ to: "/leads/wizard", search: { leadId } });
                }}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
              >
                <Sparkles className="h-4 w-4" />
                AI Roof Wizard
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!leadId) return;
                  onClose();
                  navigate({ to: "/leads/savings", search: { leadId } });
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-opacity hover:bg-emerald-700"
              >
                <FileDown className="h-4 w-4" />
                Generate Savings Report
              </button>
            </div>
            {leadId && (
              <button
                type="button"
                onClick={generateAndSaveReport}
                disabled={generatingReport}
                className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
                style={{ borderColor: "var(--border)" }}
              >
                {generatingReport ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                {generatingReport ? "Saving…" : "Save quick PDF to lead"}
              </button>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <ActionBtn color="#22c55e" icon={<Phone className="h-3.5 w-3.5" />} label="Call" onClick={() => logQuickAction("call")} />
              <ActionBtn color="#3b82f6" icon={<Mail className="h-3.5 w-3.5" />} label="Email" onClick={() => logQuickAction("email")} />
              <ActionBtn color="#a855f7" icon={<MessageSquare className="h-3.5 w-3.5" />} label="Text" onClick={() => logQuickAction("text")} />
            </div>

            <Section title="Reports">
              {reports.length === 0 ? (
                <p className="text-xs text-muted-foreground">No reports saved yet. Use “Generate Report” above to build one.</p>
              ) : (
                <ul className="space-y-2">
                  {reports.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-2"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <FileText className="h-3.5 w-3.5 text-[var(--primary)] shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.kind} • {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openSignedUrl("lead-reports", r.pdf_path, `${r.name}.pdf`)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium hover:bg-[var(--bg-hover)]"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <Download className="h-3 w-3" /> Open
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Photos & Documents">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mb-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border-2 border-dashed text-xs font-medium text-muted-foreground transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload photos or PDFs
              </button>
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No files uploaded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-2"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {d.kind} • {d.size_bytes ? `${(d.size_bytes / 1024).toFixed(0)} KB` : "—"} • {new Date(d.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openSignedUrl("lead-documents", d.storage_path, d.name)}
                          className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium hover:bg-[var(--bg-hover)]"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDocument(d.id, d.storage_path)}
                          className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium text-[#ef4444] hover:bg-[var(--bg-hover)]"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Add Note">
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Type a note…" />
              <button onClick={() => addNote.mutate()} disabled={!noteText.trim() || addNote.isPending} className="btn-brand mt-2 h-9 w-full rounded-md text-sm font-semibold disabled:opacity-40">
                {addNote.isPending ? "Saving…" : "Save Note"}
              </button>
            </Section>

            {lead.ai_report && Object.keys(lead.ai_report).length > 0 && (
              <Section title="AI Roof Report">
                {(() => {
                  const r = lead.ai_report as { analysis?: string; measurements?: { total_sqft?: number; sun_hours_per_year?: number; avg_pitch?: number; segment_count?: number; generated_at?: string } };
                  const m = r.measurements;
                  return (
                    <div className="space-y-2">
                      {m && (
                        <div className="grid grid-cols-2 gap-2">
                          <Field k="Roof Area" v={m.total_sqft != null ? `${fmtNum(m.total_sqft)} sqft` : "—"} />
                          <Field k="Avg Pitch" v={m.avg_pitch != null ? `${m.avg_pitch.toFixed(1)}°` : "—"} />
                          <Field k="Sun hrs / yr" v={m.sun_hours_per_year != null ? fmtNum(m.sun_hours_per_year) : "—"} />
                          <Field k="Segments" v={m.segment_count ?? "—"} />
                        </div>
                      )}
                      {r.analysis && (
                        <div className="rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)", whiteSpace: "pre-wrap" }}>
                          {r.analysis}
                        </div>
                      )}
                    </div>
                  );
                })()}
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
    report_sent: <Mail className="h-3.5 w-3.5 text-[#7dc3ff]" />,
    report_generated: <FileText className="h-3.5 w-3.5 text-[var(--primary)]" />,
    document_uploaded: <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />,
  };
  return <div className="mt-0.5">{map[type] ?? <Activity className="h-3.5 w-3.5" />}</div>;
}
