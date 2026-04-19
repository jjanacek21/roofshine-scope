import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Calendar, FileText } from "lucide-react";
import { TRADES, JOB_STATUSES, type JobStatus } from "@/lib/trades";
import { MapPreview } from "@/components/jobs/MapPreview";

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

  const updateJob = useMutation({
    mutationFn: async (patch: {
      status?: JobStatus;
      primary_trade?: string | null;
      notes?: string | null;
    }) => {
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
            <div className="space-y-2 text-sm">
              <Link
                to="/clients/$id"
                params={{ id: client.id }}
                className="block text-base font-semibold text-foreground hover:text-[var(--brand)]"
              >
                {client.name}
              </Link>
              <div className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                {client.email && (
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <a href={`mailto:${client.email}`} className="hover:text-foreground">
                      {client.email}
                    </a>
                  </span>
                )}
                {client.phone && (
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    <a href={`tel:${client.phone}`} className="hover:text-foreground">
                      {client.phone}
                    </a>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No client linked.</p>
          )}
        </Card>

        {/* Property Info */}
        <Card title="Property">
          <div className="space-y-2 text-sm">
            <p className="inline-flex items-start gap-2 text-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{property?.address ?? job.property_address ?? "—"}</span>
            </p>
            {property && (property.lat != null || property.lng != null) && (
              <p className="ml-5 font-mono-num text-[11px] text-muted-foreground">
                {Number(property.lat).toFixed(5)}, {Number(property.lng).toFixed(5)}
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 pt-1 text-[12px]">
              <Field label="Type" value={property?.property_type ?? "—"} />
              <Field label="Year Built" value={property?.year_built?.toString() ?? "—"} />
              <Field label="Roof Type" value={property?.roof_type ?? "—"} />
            </div>
          </div>
        </Card>

        {/* Job Info */}
        <Card title="Job">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Job Number" value={job.job_number ?? "—"} mono />
            <Field label="Job Type" value={job.job_type ?? "—"} />
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
                onChange={(e) =>
                  updateJob.mutate({ primary_trade: e.target.value || null })
                }
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
            <Field label="Insurance Carrier" value={job.insurance_carrier ?? "—"} />
            <Field label="Claim #" value={job.claim_number ?? "—"} mono />
            <Field label="Jurisdiction" value={job.jurisdiction ?? "—"} />
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
