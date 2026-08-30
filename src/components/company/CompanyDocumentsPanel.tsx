import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Download,
  FileWarning,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useProfile, useIsCompanyAdmin } from "@/hooks/useProfile";
import {
  CREDENTIAL_KINDS,
  credentialUrl,
  expiryOf,
  kindSpec,
  listCredentials,
  removeCredential,
  saveCredential,
  type CredentialKind,
} from "@/lib/permits/credentials";
import type { CompanyCredential } from "@/lib/permits/db";

/**
 * Company documents.
 *
 * One place for the certificates every job needs, so they are uploaded once
 * instead of once per permit. Each row says what it is used for, because a
 * document with no visible purpose gets left blank — and the expiry is given
 * as plain words rather than a date, since "expired 6 days ago" is the thing
 * you need to notice, not "05/14/2026".
 */

const card = { borderColor: "var(--border)", background: "var(--bg-card)" };

export function CompanyDocumentsPanel() {
  const { data: profile } = useProfile();
  const isAdmin = useIsCompanyAdmin();
  const companyId = profile?.company_id ?? null;

  const [rows, setRows] = useState<CompanyCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<CredentialKind | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      setRows(await listCredentials(companyId));
    } catch (e) {
      console.error(e);
      toast.error("Could not load company documents");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byKind = new Map(rows.map((r) => [r.kind, r]));

  async function handleOpen(c: CompanyCredential) {
    try {
      const url = await credentialUrl(c);
      if (url) window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Could not open that file");
    }
  }

  async function handleDelete(c: CompanyCredential) {
    setBusy(c.kind);
    try {
      await removeCredential(c);
      toast.success(`${kindSpec(c.kind).label} removed`);
      await load();
    } catch {
      toast.error("Could not remove that document");
    } finally {
      setBusy(null);
    }
  }

  if (!companyId) {
    return (
      <div className="rounded-xl border p-6 text-[13px]" style={card}>
        <p className="text-foreground">Your account isn't linked to a company yet.</p>
      </div>
    );
  }

  const expiredCount = rows.filter((r) => expiryOf(r).state === "expired").length;
  const expiringCount = rows.filter((r) => expiryOf(r).state === "expiring").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Company documents</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Upload each of these once. Every permit packet pulls them automatically, and the packet
          warns you before one lapses.
        </p>
      </div>

      {(expiredCount > 0 || expiringCount > 0) && (
        <div
          className="flex items-start gap-2 rounded-xl border p-3"
          style={{ borderColor: expiredCount ? "#dc2626" : "#f59e0b", background: expiredCount ? "rgba(220,38,38,0.06)" : "rgba(245,158,11,0.08)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: expiredCount ? "#b91c1c" : "#b45309" }} />
          <p className="text-[12px] text-foreground">
            {expiredCount > 0 && (
              <>
                {expiredCount} document{expiredCount === 1 ? " has" : "s have"} expired — packets
                using {expiredCount === 1 ? "it" : "them"} will be rejected at the counter.{" "}
              </>
            )}
            {expiringCount > 0 && <>{expiringCount} expires within 30 days.</>}
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-[var(--bg-card)]" />
          <div className="h-20 animate-pulse rounded-xl bg-[var(--bg-card)]" />
        </div>
      ) : (
        <div className="space-y-2">
          {CREDENTIAL_KINDS.map((spec) => {
            const row = byKind.get(spec.kind) ?? null;
            const exp = row ? expiryOf(row) : null;
            return (
              <div key={spec.kind} className="rounded-xl border p-4" style={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {row?.storage_path ? (
                        exp?.state === "expired" ? (
                          <FileWarning className="h-4 w-4 shrink-0 text-red-600" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        )
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <p className="text-[13px] font-semibold text-foreground">{spec.label}</p>
                      {row?.number && (
                        <span className="text-[12px] text-muted-foreground">· {row.number}</span>
                      )}
                    </div>

                    <p className="mt-1 text-[12px] text-muted-foreground">{spec.hint}</p>

                    {row?.storage_path ? (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <button
                          onClick={() => void handleOpen(row)}
                          className="inline-flex items-center gap-1 underline"
                          style={{ color: "var(--brand)" }}
                        >
                          <Download className="h-3 w-3" />
                          {row.file_name ?? "View file"}
                        </button>
                        {exp && (
                          <span
                            style={{
                              color:
                                exp.state === "expired"
                                  ? "#b91c1c"
                                  : exp.state === "expiring"
                                    ? "#b45309"
                                    : "var(--muted-foreground)",
                            }}
                          >
                            {exp.text}
                          </span>
                        )}
                        {row.holder_name && (
                          <span className="text-muted-foreground">{row.holder_name}</span>
                        )}
                      </div>
                    ) : (
                      spec.usedFor && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Needed for: {spec.usedFor}
                        </p>
                      )
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => setOpen(open === spec.kind ? null : spec.kind)}
                        className="rounded-lg border px-3 py-1.5 text-[12px]"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {row?.storage_path ? "Replace" : "Add"}
                      </button>
                      {row && (
                        <button
                          onClick={() => void handleDelete(row)}
                          disabled={busy === spec.kind}
                          className="rounded-lg border p-1.5 text-muted-foreground disabled:opacity-50"
                          style={{ borderColor: "var(--border)" }}
                          aria-label={`Remove ${spec.label}`}
                        >
                          {busy === spec.kind ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {open === spec.kind && isAdmin && (
                  <CredentialForm
                    companyId={companyId}
                    kind={spec.kind}
                    existing={row}
                    onDone={async () => {
                      setOpen(null);
                      await load();
                    }}
                    onCancel={() => setOpen(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isAdmin && (
        <p className="text-[12px] text-muted-foreground">
          You can see these documents, but only a company admin can change them.
        </p>
      )}
    </div>
  );
}

function CredentialForm({
  companyId,
  kind,
  existing,
  onDone,
  onCancel,
}: {
  companyId: string;
  kind: CredentialKind;
  existing: CompanyCredential | null;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const spec = kindSpec(kind);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [holder, setHolder] = useState(existing?.holder_name ?? "");
  const [number, setNumber] = useState(existing?.number ?? "");
  const [issuer, setIssuer] = useState(existing?.issuer ?? "");
  const [expires, setExpires] = useState(existing?.expires_on ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!file && !existing?.storage_path) {
      toast.error("Pick a file first");
      return;
    }
    setSaving(true);
    try {
      await saveCredential(
        companyId,
        {
          kind,
          label: label || null,
          holder_name: holder || null,
          number: number || null,
          issuer: issuer || null,
          expires_on: expires || null,
        },
        file,
        existing ?? undefined,
      );
      toast.success(`${spec.label} saved`);
      await onDone();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not save that document");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        accept=".pdf,image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <button
        onClick={() => fileRef.current?.click()}
        className="mb-3 inline-flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-[12px]"
        style={{ borderColor: "var(--border)" }}
      >
        <UploadCloud className="h-4 w-4" />
        {file ? file.name : existing?.file_name ? `Replace ${existing.file_name}` : "Choose a PDF or photo"}
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        {spec.kind === "other" && (
          <Text label="What is it?" value={label} onChange={setLabel} />
        )}
        {spec.numberLabel && (
          <Text label={spec.numberLabel} value={number} onChange={setNumber} />
        )}
        {spec.kind === "qualifier_license" && (
          <Text label="Qualifier name" value={holder} onChange={setHolder} />
        )}
        {(spec.kind === "general_liability" ||
          spec.kind === "workers_comp" ||
          spec.kind === "surety_bond") && (
          <Text label="Carrier" value={issuer} onChange={setIssuer} />
        )}
        {spec.expires && (
          <div>
            <label className="mb-1 block text-[12px] text-muted-foreground">Expires on</label>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-1.5 text-[12px]"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ background: "var(--brand)" }}
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 text-[12px]"
          style={{ borderColor: "var(--border)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] text-muted-foreground">{label}</label>
      <input
        className="w-full rounded-lg border px-3 py-1.5 text-[12px]"
        style={{ borderColor: "var(--border)", background: "var(--bg)" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
