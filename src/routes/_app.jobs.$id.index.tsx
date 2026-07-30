import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Calendar, FileText } from "lucide-react";
import { TRADES, JOB_STATUSES, type JobStatus } from "@/lib/trades";
import { MapPreview } from "@/components/jobs/MapPreview";
import { JobContractsList } from "@/components/contracts/JobContractsList";
import { resolvePriceBook } from "@/lib/resolve-price-book";

export const Route = createFileRoute("/_app/jobs/$id/")({
  component: JobOverview,
});

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function JobOverview() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: job } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["job-client", job?.client_id],
    enabled: !!job?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("id", job!.client_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: property } = useQuery({
    queryKey: ["job-property", job?.property_id],
    enabled: !!job?.property_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("*")
        .eq("id", job!.property_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: books = [] } = useQuery({
    queryKey: ["job-price-books"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name, jurisdiction")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  // Suggest the market book for this property's ZIP/state (IL → Chicago, South FL → South Florida)
  useEffect(() => {
    if (!job || job.price_book_id || !job.company_id) return;
    let alive = true;
    (async () => {
      const r = await resolvePriceBook({
        companyId: job.company_id,
        zip: (property?.zip as string | null) ?? null,
        state: (property?.state as string | null) ?? null,
        jurisdiction: job.jurisdiction ?? null,
      });
      if (alive && r) updateJob.mutate({ price_book_id: r.id });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.price_book_id, property?.zip, property?.state]);

  const updateJob = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("jobs")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["jobs-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProperty = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!job?.property_id) throw new Error("This job has no linked property");
      const { error } = await supabase.from("properties").update(patch as never).eq("id", job.property_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Property updated");
      qc.invalidateQueries({ queryKey: ["job-property", job?.property_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateClient = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!job?.client_id) throw new Error("This job has no linked client");
      const { error } = await supabase.from("clients").update(patch as never).eq("id", job.client_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client updated");
      qc.invalidateQueries({ queryKey: ["job-client", job?.client_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Notes draft + autosave on blur
  const [notesDraft, setNotesDraft] = useState<string>("");
  useEffect(() => {
    setNotesDraft(job?.notes ?? "");
  }, [job?.notes]);

  if (!job) return null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
      {/* LEFT 65% */}
      <div className="space-y-5">
        {/* Client Info */}
        <Card title="Client">
          {client ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <EditableText
                  label="Name"
                  value={client.name ?? ""}
                  onSave={(v) => updateClient.mutate({ name: v })}
                />
                <Link
                  to="/clients/$id"
                  params={{ id: client.id }}
                  className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand)] hover:underline"
                >
                  Open
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <EditableText
                  label="Email"
                  icon={<Mail className="h-3 w-3" />}
                  value={client.email ?? ""}
                  onSave={(v) => updateClient.mutate({ email: v || null })}
                />
                <EditableText
                  label="Phone"
                  icon={<Phone className="h-3 w-3" />}
                  value={client.phone ?? ""}
                  onSave={(v) => updateClient.mutate({ phone: v || null })}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No client linked.</p>
          )}
        </Card>

        {/* Property Info */}
        <Card title="Property">
          <div className="space-y-3 text-sm">
            {property ? (
              <>
                <EditableText
                  label="Address"
                  icon={<MapPin className="h-3 w-3" />}
                  value={property.address ?? ""}
                  onSave={(v) => updateProperty.mutate({ address: v })}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <EditableText label="City" value={property.city ?? ""} onSave={(v) => updateProperty.mutate({ city: v || null })} />
                  <EditableText label="State" value={property.state ?? ""} onSave={(v) => updateProperty.mutate({ state: v || null })} />
                  <EditableText label="ZIP" value={property.zip ?? ""} onSave={(v) => updateProperty.mutate({ zip: v || null })} />
                  <EditableText label="Type" value={property.property_type ?? ""} onSave={(v) => updateProperty.mutate({ property_type: v || null })} />
                  <EditableText
                    label="Year Built"
                    value={property.year_built?.toString() ?? ""}
                    onSave={(v) => updateProperty.mutate({ year_built: v ? Number(v) : null })}
                  />
                  <EditableText label="Roof Type" value={property.roof_type ?? ""} onSave={(v) => updateProperty.mutate({ roof_type: v || null })} />
                </div>
                {(property.lat != null || property.lng != null) && (
                  <p className="font-mono-num text-[11px] text-muted-foreground">
                    {Number(property.lat).toFixed(5)}, {Number(property.lng).toFixed(5)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">{job.property_address ?? "No property linked."}</p>
            )}
          </div>
        </Card>

        {/* Job Info */}
        <Card title="Job">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EditableText label="Job Name" value={job.name ?? ""} mono={false} onSave={(v) => updateJob.mutate({ name: v })} />
            <EditableText label="Job Number" value={job.job_number ?? ""} mono onSave={(v) => updateJob.mutate({ job_number: v || null })} />
            <div>
              <FieldLabel>Job Type</FieldLabel>
              <select
                value={job.job_type ?? ""}
                onChange={(e) => updateJob.mutate({ job_type: e.target.value || null })}
                className="field-input mt-1 h-9 text-sm"
              >
                <option value="">— None —</option>
                <option value="insurance">Insurance</option>
                <option value="retail">Retail</option>
              </select>
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                value={job.status}
                onChange={(e) => updateJob.mutate({ status: e.target.value as JobStatus })}
                className="field-input mt-1 h-9 text-sm"
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Primary Trade</FieldLabel>
              <select
                value={job.primary_trade ?? ""}
                onChange={(e) => updateJob.mutate({ primary_trade: e.target.value || null })}
                className="field-input mt-1 h-9 text-sm"
              >
                <option value="">— None —</option>
                {TRADES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Market Pricing</FieldLabel>
              <select
                value={job.price_book_id ?? ""}
                onChange={(e) => updateJob.mutate({ price_book_id: e.target.value || null })}
                className="field-input mt-1 h-9 text-sm"
              >
                <option value="">— None —</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <EditableText
              label="Insurance Carrier"
              value={job.insurance_carrier ?? ""}
              onSave={(v) => updateJob.mutate({ insurance_carrier: v || null })}
            />
            <EditableText
              label="Claim #"
              mono
              value={job.claim_number ?? ""}
              onSave={(v) => updateJob.mutate({ claim_number: v || null })}
            />
            <EditableText
              label="Jurisdiction"
              value={job.jurisdiction ?? ""}
              onSave={(v) => updateJob.mutate({ jurisdiction: v || null })}
            />
            <Field label="Total Estimate" value={`$${Number(job.total_estimate ?? 0).toLocaleString()}`} mono />
          </div>
        </Card>

        {/* Notes */}
        <Card title="Notes">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => {
              if (notesDraft !== (job.notes ?? "")) {
                updateJob.mutate({ notes: notesDraft || null });
                toast.success("Notes saved");
              }
            }}
            placeholder="Inspection notes, scope details, conversations…"
            rows={6}
            className="field-input resize-y text-sm"
          />
        </Card>
      </div>

      {/* RIGHT 35% */}
      <div className="space-y-5">
        <Card title="Map Preview">
          <MapPreview
            jobId={job.id}
            lat={property?.lat as number | null}
            lng={property?.lng as number | null}
            width={600}
            height={420}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Click the map to open the Measurements workspace.
          </p>
        </Card>

        <Card title="Activity">
          <ul className="space-y-3 text-sm">
            <ActivityRow
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Job created"
              ts={job.created_at}
            />
            <ActivityRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Last updated"
              ts={job.updated_at}
            />
          </ul>
        </Card>

        <JobContractsList jobId={job.id} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{children}</span>
  );
}

function EditableText({
  label,
  value,
  onSave,
  mono,
  icon,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div>
      <FieldLabel>
        <span className="inline-flex items-center gap-1">
          {icon}
          {label}
        </span>
      </FieldLabel>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== value) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="—"
        className={`field-input mt-1 h-9 text-sm ${mono ? "font-mono-num" : ""}`}
      />
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p className={`mt-1 text-sm text-foreground ${mono ? "font-mono-num" : ""}`}>{value}</p>
    </div>
  );
}

function ActivityRow({
  icon,
  label,
  ts,
}: {
  icon: React.ReactNode;
  label: string;
  ts: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        style={{ backgroundColor: "var(--bg-elevated)" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{timeAgo(ts)}</p>
      </div>
    </li>
  );
}
