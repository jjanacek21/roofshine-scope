import { useMemo, useState } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { importLeads } from "@/lib/leads.functions";
import {
  buildLeads,
  detectMapping,
  ignoredHeaders,
  ROLE_LABELS,
  type ColumnMapping,
  type FieldRole,
  type ParseReport,
} from "@/lib/commercial/reonomy-import";

const BATCH_SIZE = 200;
const ROW_LIMIT = 20_000;

const ROLE_OPTIONS: FieldRole[] = [
  "ignored",
  "address",
  "city",
  "state",
  "zip",
  "owner",
  "contact_name",
  "contact_first",
  "contact_last",
  "contact_title",
  "contact_phone",
  "contact_email",
];

export function ReonomyImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const importFn = useServerFn(importLeads);

  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Re-derived whenever a role is changed, so the preview always reflects the mapping.
  const report: ParseReport | null = useMemo(
    () => (rows.length > 0 && mapping.length > 0 ? buildLeads(rows, mapping) : null),
    [rows, mapping],
  );

  function reset() {
    setFilename("");
    setRows([]);
    setMapping([]);
    setParseError(null);
    setProgress(null);
  }

  function handleFile(file: File) {
    setParseError(null);
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = (res.meta.fields ?? []).filter(Boolean);
        if (headers.length === 0) {
          setParseError("That file has no header row. Export from Reonomy with headers included.");
          setRows([]);
          setMapping([]);
          return;
        }
        const data = res.data.slice(0, ROW_LIMIT);
        setRows(data);
        setMapping(detectMapping(headers));
        if (res.data.length > ROW_LIMIT) {
          toast.warning(
            `File has ${res.data.length.toLocaleString()} rows — importing the first ${ROW_LIMIT.toLocaleString()}.`,
          );
        }
      },
      error: (err) => {
        setParseError(err.message || "Could not read that file.");
        setRows([]);
        setMapping([]);
      },
    });
  }

  function setRole(header: string, role: FieldRole) {
    setMapping((prev) =>
      prev.map((m) => (m.header === header ? { ...m, role, overridden: true } : m)),
    );
  }

  const importMut = useMutation({
    mutationFn: async () => {
      if (!report) throw new Error("Nothing to import");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again before importing.");
      const headers = { Authorization: `Bearer ${token}` };

      const leads = report.leads;
      let created = 0;
      let merged = 0;
      let contactsInserted = 0;
      let phonesInserted = 0;
      let emailsInserted = 0;
      const errors: string[] = [];

      setProgress({ done: 0, total: leads.length });
      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        try {
          const res = await importFn({ data: { leads: batch }, headers });
          created += res.created ?? res.inserted ?? 0;
          merged += res.merged ?? 0;
          contactsInserted += res.contactsInserted ?? 0;
          phonesInserted += res.phonesInserted ?? 0;
          emailsInserted += res.emailsInserted ?? 0;
          if (res.errors?.length) errors.push(...res.errors);
        } catch (err) {
          const msg =
            err instanceof Response
              ? (await err.text().catch(() => "")) || `Server error ${err.status}`
              : err instanceof Error
                ? err.message
                : "Unknown error";
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${msg}`);
        }
        setProgress({ done: Math.min(i + BATCH_SIZE, leads.length), total: leads.length });
      }
      return { created, merged, contactsInserted, phonesInserted, emailsInserted, errors };
    },
    onSuccess: (res) => {
      setProgress(null);
      qc.invalidateQueries({ queryKey: ["leads"] });
      const bits = [`${res.created} new`];
      if (res.merged) bits.push(`${res.merged} updated`);
      if (res.contactsInserted) bits.push(`+${res.contactsInserted} contacts`);
      if (res.phonesInserted) bits.push(`+${res.phonesInserted} phones`);
      if (res.emailsInserted) bits.push(`+${res.emailsInserted} emails`);
      if (res.errors.length) {
        toast.warning(`Imported ${bits.join(", ")} — ${res.errors.length} row(s) had problems.`);
      } else {
        toast.success(`Imported ${bits.join(", ")}.`);
      }
      reset();
      onClose();
    },
    onError: (e) => {
      setProgress(null);
      toast.error(e instanceof Error ? e.message : "Import failed");
    },
  });

  if (!open) return null;

  const ignored = mapping.length > 0 ? ignoredHeaders(mapping) : [];
  const hasAddress = mapping.some((m) => m.role === "address");
  const canImport = !!report && report.propertyCount > 0 && hasAddress && !importMut.isPending;

  return (
    <div
      data-rk
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(5,7,12,0.7)" }}
      onClick={() => !importMut.isPending && onClose()}
    >
      <div
        className="rk-card flex max-h-[88vh] w-full max-w-3xl flex-col p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="rk-display text-lg">Import from Reonomy</h2>
            <p className="text-xs" style={{ color: "var(--rk-ink-faint)" }}>
              Upload the CSV exactly as it downloads. Owners, contacts, phone numbers and emails are
              pulled out; everything else is left behind.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={importMut.isPending}
            className="rounded p-1 hover:bg-[var(--rk-panel-2)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed p-10 text-center"
              style={{ borderColor: "var(--rk-line-2)" }}
            >
              <Upload className="h-7 w-7" style={{ color: "var(--rk-ink-faint)" }} />
              <div>
                <div className="text-sm font-semibold">Choose a Reonomy export</div>
                <div className="text-xs" style={{ color: "var(--rk-ink-faint)" }}>
                  CSV, up to {ROW_LIMIT.toLocaleString()} rows
                </div>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4" style={{ color: "var(--rk-ink-faint)" }} />
                <span className="font-medium">{filename}</span>
                <button
                  onClick={reset}
                  className="ml-auto text-xs underline"
                  style={{ color: "var(--rk-ink-faint)" }}
                >
                  Choose a different file
                </button>
              </div>

              {report && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Properties" value={report.propertyCount} />
                  <Stat label="Contacts" value={report.contactCount} />
                  <Stat label="Phone numbers" value={report.phoneCount} />
                  <Stat label="Emails" value={report.emailCount} />
                </div>
              )}

              {report && report.skippedNoAddress > 0 && (
                <Note>
                  {report.skippedNoAddress} row(s) had no property address and will be skipped.
                </Note>
              )}
              {report?.warnings.map((w) => (
                <Note key={w}>{w}</Note>
              ))}
              {!hasAddress && (
                <Note>
                  Set one column to <strong>Property address</strong> before importing.
                </Note>
              )}

              <div>
                <div className="rk-label mb-2">Columns</div>
                <div
                  className="overflow-hidden rounded-[var(--radius)] border"
                  style={{ borderColor: "var(--rk-line)" }}
                >
                  {mapping.map((m, i) => (
                    <div
                      key={m.header}
                      className="flex items-center gap-3 px-3 py-2"
                      style={{
                        borderTop: i === 0 ? undefined : "1px solid var(--rk-line)",
                        background: m.role === "ignored" ? undefined : "var(--rk-panel-2)",
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{m.header}</div>
                        {m.contactIndex !== null && (
                          <div className="text-[10px]" style={{ color: "var(--rk-ink-faint)" }}>
                            Contact {m.contactIndex}
                          </div>
                        )}
                      </div>
                      <select
                        className="rk-input w-[190px] shrink-0"
                        value={m.role}
                        onChange={(e) => setRole(m.header, e.target.value as FieldRole)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {ignored.length > 0 && (
                  <p className="mt-2 text-[11px]" style={{ color: "var(--rk-ink-faint)" }}>
                    Not imported: {ignored.join(", ")}
                  </p>
                )}
              </div>

              {report && report.leads.length > 0 && (
                <div>
                  <div className="rk-label mb-2">First property</div>
                  <div
                    className="rounded-[var(--radius)] border p-3 text-xs"
                    style={{ borderColor: "var(--rk-line)" }}
                  >
                    <div className="font-semibold">{report.leads[0].address}</div>
                    <div style={{ color: "var(--rk-ink-faint)" }}>
                      {[report.leads[0].city, report.leads[0].state, report.leads[0].zip]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </div>
                    {report.leads[0].owner && (
                      <div className="mt-1">Owner: {report.leads[0].owner}</div>
                    )}
                    {report.leads[0].contacts.map((c) => (
                      <div key={c.name} className="mt-2">
                        <span className="font-medium">{c.name}</span>
                        {c.title ? ` — ${c.title}` : ""}
                        <div style={{ color: "var(--rk-ink-faint)" }}>
                          {[...c.phones, ...c.emails].join(" · ") || "no contact details"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {parseError && <Note>{parseError}</Note>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          {progress && (
            <span className="mr-auto text-xs" style={{ color: "var(--rk-ink-faint)" }}>
              Importing {progress.done} of {progress.total}…
            </span>
          )}
          <button onClick={onClose} disabled={importMut.isPending} className="rk-btn rk-btn-ghost">
            Cancel
          </button>
          <button
            disabled={!canImport}
            onClick={() => importMut.mutate()}
            className="rk-btn rk-btn-primary"
          >
            {importMut.isPending
              ? "Importing…"
              : report
                ? `Import ${report.propertyCount} propert${report.propertyCount === 1 ? "y" : "ies"}`
                : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-[var(--radius)] border px-3 py-2"
      style={{ borderColor: "var(--rk-line)" }}
    >
      <div className="rk-num text-lg font-semibold">{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--rk-ink-faint)" }}>
        {label}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2 text-xs"
      style={{ borderColor: "var(--rk-line-2)", background: "var(--rk-panel-2)" }}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--rk-gold)" }} />
      <span>{children}</span>
    </div>
  );
}
