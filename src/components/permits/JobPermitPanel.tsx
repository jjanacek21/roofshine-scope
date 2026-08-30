import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Circle,
  Download,
  FileSignature,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useJobPermit } from "@/hooks/useJobPermit";
import { downloadForm, fillApplication } from "@/lib/permits/fill";
import { approvalLabel, jobPermitDocuments } from "@/lib/permits/db";
import { supabase } from "@/integrations/supabase/client";
import type { Requirement } from "@/lib/permits/checklist";

/**
 * The permit tab.
 *
 * Ordered the way the work actually happens: confirm where you are filing,
 * see what the job already answers, fill the gaps it cannot, then collect
 * signatures. The "pulled from the job" section is deliberately prominent —
 * the whole point of the tab is that this information is not retyped, and
 * showing where each value came from is what makes that trustworthy.
 */

const WORK_TYPES = [
  { value: "reroof_replacement", label: "Re-roof — tear off and replace" },
  { value: "recover_overlay", label: "Recover — overlay" },
  { value: "repair", label: "Repair" },
  { value: "new_construction", label: "New construction" },
];

const card = { borderColor: "var(--border)", background: "var(--bg-card)" };

export function JobPermitPanel({ jobId }: { jobId: string }) {
  const {
    permit,
    context,
    packet,
    documents,
    departments,
    suggestion,
    loading,
    error,
    reload,
    ensurePermit,
    savePermit,
  } = useJobPermit(jobId);

  const [filling, setFilling] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKey = useRef<string | null>(null);

  const pulled = useMemo(() => {
    if (!context) return [];
    return (Object.keys(context.values) as (keyof typeof context.values)[])
      .filter((k) => k !== "today" && context.values[k])
      .map((k) => ({ key: k, value: context.values[k]!, origin: context.origins[k] }));
  }, [context]);

  async function handleFill() {
    if (!context) return;
    setFilling(true);
    try {
      const filled = await fillApplication(context);
      downloadForm(filled);

      /* Keep a copy on the packet so the checklist can see it and the next
         person to open the job finds it where they expect. */
      const row = await ensurePermit();
      const path = `${context.companyId}/${jobId}/permits/${Date.now()}-${filled.fileName}`;
      const { error: upErr } = await supabase.storage
        .from("job-documents")
        .upload(path, new Blob([filled.bytes as unknown as BlobPart], { type: "application/pdf" }), {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) throw upErr;
      await jobPermitDocuments().insert({
        permit_id: row.id,
        company_id: context.companyId,
        doc_key: "permit_application_draft",
        title: filled.template.form_name,
        origin: "generated",
        bucket: "job-documents",
        storage_path: path,
        file_name: filled.fileName,
        mime_type: "application/pdf",
        status: "needs_signature",
        notes: "Filled from the job. Print, sign, and upload the executed copy.",
      });

      if (filled.blanks.length) {
        toast.warning(`Filled ${filled.template.form_name}. Still blank: ${filled.blanks.join(", ")}`);
      } else {
        toast.success(`${filled.template.form_name} filled — print, sign, and upload it.`);
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not fill the application");
    } finally {
      setFilling(false);
    }
  }

  function pickFile(docKey: string) {
    pendingKey.current = docKey;
    fileRef.current?.click();
  }

  async function handleUpload(file: File) {
    const docKey = pendingKey.current;
    pendingKey.current = null;
    if (!docKey || !context) return;
    setUploadingFor(docKey);
    try {
      const row = await ensurePermit();
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${context.companyId}/${jobId}/permits/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("job-documents").upload(path, file);
      if (upErr) throw upErr;
      await jobPermitDocuments().insert({
        permit_id: row.id,
        company_id: context.companyId,
        doc_key: docKey,
        title: file.name,
        origin: "uploaded",
        bucket: "job-documents",
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        status: "provided",
      });
      toast.success(`${file.name} added to the packet`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingFor(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-1">
        <div className="h-24 animate-pulse rounded-xl bg-[var(--bg-card)]" />
        <div className="h-40 animate-pulse rounded-xl bg-[var(--bg-card)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border p-6 text-[13px]" style={card}>
        <p className="font-medium text-foreground">Could not load the permit</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{error}</p>
      </div>
    );
  }

  const dept = context?.department ?? null;

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleUpload(f);
        }}
      />

      {/* ── where this is being filed ── */}
      <section className="rounded-xl border p-4" style={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" style={{ color: "var(--brand)" }} />
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                {dept?.name ?? "No jurisdiction set"}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {dept
                  ? [dept.county && `${dept.county} County`, dept.is_hvhz && "HVHZ"]
                      .filter(Boolean)
                      .join(" · ")
                  : "Pick the building department that issues this permit."}
              </p>
            </div>
          </div>

          <select
            className="rounded-lg border px-3 py-1.5 text-[12px]"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            value={permit?.building_dept_id ?? ""}
            onChange={(e) => void savePermit({ building_dept_id: e.target.value || null })}
          >
            <option value="">Select department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {!permit?.building_dept_id && suggestion && (
          <button
            onClick={() => void savePermit({ building_dept_id: suggestion.department.id })}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px]"
            style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Use {suggestion.department.name} — matched on the property{" "}
            {suggestion.basis === "zip" ? "ZIP" : suggestion.basis}
          </button>
        )}
      </section>

      {/* ── what the job already answers ── */}
      <section className="rounded-xl border p-4" style={card}>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">Pulled from this job</h3>
          <span className="text-[12px] text-muted-foreground">{pulled.length} fields</span>
        </div>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {pulled.map((p) => (
            <div key={p.key} className="flex items-baseline justify-between gap-3 border-b pb-1.5"
                 style={{ borderColor: "var(--border)" }}>
              <span className="shrink-0 text-[12px] text-muted-foreground">{labelFor(p.key)}</span>
              <span className="truncate text-right text-[12px] text-foreground" title={`${p.value} — from ${p.origin}`}>
                {p.value}
                <span className="ml-1.5 text-[11px] text-muted-foreground">· {p.origin}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── the handful of things only the permit knows ── */}
      <section className="rounded-xl border p-4" style={card}>
        <h3 className="mb-1 text-[13px] font-semibold text-foreground">Permit details</h3>
        <p className="mb-3 text-[12px] text-muted-foreground">
          The county asks for these and nothing else in the job has a place to keep them.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Folio / parcel number" value={permit?.folio_number ?? ""}
                 onSave={(v) => savePermit({ folio_number: v })} />
          <Field label="Job value ($)" value={permit?.valuation != null ? String(permit.valuation) : ""}
                 onSave={(v) => savePermit({ valuation: v ? Number(v) : null })} />
          <div className="sm:col-span-2">
            <Field label="Legal description" value={permit?.legal_description ?? ""}
                   onSave={(v) => savePermit({ legal_description: v })} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-muted-foreground">Type of work</label>
            <select
              className="w-full rounded-lg border px-3 py-1.5 text-[12px]"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              value={permit?.work_type ?? ""}
              onChange={(e) => void savePermit({ work_type: e.target.value || null })}
            >
              <option value="">Not set…</option>
              {WORK_TYPES.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── the checklist ── */}
      {packet && (
        <section className="rounded-xl border p-4" style={card}>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold text-foreground">Packet</h3>
            <span className="text-[13px] font-semibold" style={{ color: "var(--brand)" }}>
              {packet.completion}%
            </span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
            <div className="h-full rounded-full transition-all"
                 style={{ width: `${packet.completion}%`, background: "var(--brand)" }} />
          </div>

          {context?.expired.length ? (
            <div className="mb-3 flex items-start gap-2 rounded-lg border p-3"
                 style={{ borderColor: "#f59e0b", background: "rgba(245,158,11,0.08)" }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#b45309" }} />
              <p className="text-[12px] text-foreground">
                {context.expired.length === 1 ? "A credential has" : `${context.expired.length} credentials have`}{" "}
                expired. The counter will reject the packet until they are renewed in company settings.
              </p>
            </div>
          ) : null}

          <ul className="space-y-1.5">
            {packet.requirements.map((r) => (
              <RequirementRow
                key={r.key}
                r={r}
                busy={uploadingFor === r.key}
                onUpload={() => pickFile(r.key)}
              />
            ))}
          </ul>

          <p className="mt-3 text-[11px] text-muted-foreground">
            {packet.source === "jurisdiction"
              ? `Checklist published by ${packet.jurisdiction}.`
              : "No published checklist for this jurisdiction yet — using the Florida baseline."}
          </p>
        </section>
      )}

      {/* ── product approvals ── */}
      <section className="rounded-xl border p-4" style={card}>
        <h3 className="mb-1 text-[13px] font-semibold text-foreground">Product approvals</h3>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Pulled from the approval library and attached to the packet automatically.
        </p>
        {context?.products.length ? (
          <ul className="space-y-1.5">
            {context.products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="truncate text-foreground">{approvalLabel(p)}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{p.role.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            None selected yet. Pick the products on the Order Form and they will appear here.
          </p>
        )}
      </section>

      {/* ── the one thing we can hand back ready to sign ── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void handleFill()}
          disabled={filling || !dept}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: "var(--brand)" }}
        >
          {filling ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
          Fill permit application
        </button>
        {documents.length > 0 && (
          <span className="self-center text-[12px] text-muted-foreground">
            {documents.length} file{documents.length === 1 ? "" : "s"} on this packet
          </span>
        )}
      </div>
    </div>
  );
}

function RequirementRow({
  r,
  busy,
  onUpload,
}: {
  r: Requirement;
  busy: boolean;
  onUpload: () => void;
}) {
  return (
    <li className="flex items-start gap-2.5 rounded-lg px-1 py-1.5">
      {r.satisfied ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-foreground">
          {r.name}
          {!r.required && <span className="ml-1.5 text-[11px] text-muted-foreground">optional</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {r.satisfied && r.satisfiedBy ? `From ${r.satisfiedBy}` : r.instruction}
        </p>
        {r.warning && <p className="text-[11px] text-amber-700">{r.warning}</p>}
      </div>
      {!r.satisfied && (
        <button
          onClick={onUpload}
          disabled={busy}
          className="shrink-0 rounded-md border px-2 py-1 text-[11px] disabled:opacity-50"
          style={{ borderColor: "var(--border)" }}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
        </button>
      )}
    </li>
  );
}

function Field({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-[12px] text-muted-foreground">{label}</label>
      <input
        className="w-full rounded-lg border px-3 py-1.5 text-[12px]"
        style={{ borderColor: "var(--border)", background: "var(--bg)" }}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
        }}
        onBlur={() => {
          if (!dirty) return;
          setDirty(false);
          void Promise.resolve(onSave(draft.trim())).catch(() =>
            toast.error(`Could not save ${label.toLowerCase()}`),
          );
        }}
      />
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  property_address: "Property address",
  property_city: "City",
  property_state: "State",
  property_zip: "ZIP",
  folio: "Folio",
  legal_description: "Legal description",
  square_footage: "Roof area (sq ft)",
  valuation: "Job value",
  scope_description: "Scope",
  owner_name: "Owner",
  owner_phone: "Owner phone",
  owner_email: "Owner email",
  owner_address: "Owner address",
  owner_city: "Owner city",
  owner_state: "Owner state",
  owner_zip: "Owner ZIP",
  contractor_company: "Company",
  contractor_phone: "Company phone",
  contractor_email: "Company email",
  contractor_address: "Company address",
  contractor_city: "Company city",
  contractor_state: "Company state",
  contractor_zip: "Company ZIP",
  qualifier_name: "Qualifier",
  license_number: "Licence",
  lender_name: "Lender",
  lender_address: "Lender address",
  surety_name: "Bonding company",
};

function labelFor(k: string) {
  return FIELD_LABELS[k] ?? k;
}
