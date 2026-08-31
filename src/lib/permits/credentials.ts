import { supabase } from "@/integrations/supabase/client";
import { companyCredentials, type CompanyCredential } from "./db";

/**
 * Company documents — the licence, insurance and comp certificates a permit
 * packet needs.
 *
 * These are kept per company rather than per job because they are the same on
 * every job, and re-uploading a certificate of insurance for each permit is
 * exactly the busywork this is meant to remove. The one thing that makes them
 * more than a file list is the expiry date: a certificate that lapsed last week
 * still looks like a PDF, and the counter is the wrong place to find out.
 */

export type CredentialKind = CompanyCredential["kind"];

export interface KindSpec {
  kind: CredentialKind;
  label: string;
  hint: string;
  /** Shown on the permit checklist, so packets know what this satisfies. */
  usedFor: string | null;
  /** Whether the number field means anything for this kind. */
  numberLabel: string | null;
  expires: boolean;
}

export const CREDENTIAL_KINDS: KindSpec[] = [
  {
    kind: "qualifier_license",
    label: "Qualifier license",
    hint: "The state license of the person qualifying the job — CCC, CGC, CBC.",
    usedFor: "Qualifier License on every permit packet",
    numberLabel: "License number",
    expires: true,
  },
  {
    kind: "general_liability",
    label: "General liability insurance",
    hint: "Current certificate of insurance. Most counters want to be named as certificate holder.",
    usedFor: "General Liability on every permit packet",
    numberLabel: "Policy number",
    expires: true,
  },
  {
    kind: "workers_comp",
    label: "Workers compensation",
    hint: "Current coverage certificate.",
    usedFor: "Workers Compensation on every permit packet",
    numberLabel: "Policy number",
    expires: true,
  },
  {
    kind: "workers_comp_exemption",
    label: "Workers comp exemption",
    hint: "The state exemption certificate, if you carry an exemption instead of coverage.",
    usedFor: "Workers Compensation on every permit packet",
    numberLabel: "Certificate number",
    expires: true,
  },
  {
    kind: "business_tax_receipt",
    label: "Business tax receipt",
    hint: "Local BTR. Some municipalities ask for it at the counter.",
    usedFor: "Business Tax Receipt where a county asks for it",
    numberLabel: "Receipt number",
    expires: true,
  },
  {
    kind: "surety_bond",
    label: "Surety bond",
    hint: "Bonding certificate, where a job or jurisdiction requires one.",
    usedFor: "Bonding company on the permit application",
    numberLabel: "Bond number",
    expires: true,
  },
  {
    kind: "w9",
    label: "W-9",
    hint: "For carriers and general contractors who ask before they pay.",
    usedFor: null,
    numberLabel: null,
    expires: false,
  },
  {
    kind: "other",
    label: "Other document",
    hint: "Anything else the company keeps on file — a warranty registration, a manufacturer certification.",
    usedFor: null,
    numberLabel: null,
    expires: false,
  },
];

export const kindSpec = (k: string): KindSpec =>
  CREDENTIAL_KINDS.find((s) => s.kind === k) ?? CREDENTIAL_KINDS[CREDENTIAL_KINDS.length - 1];

export type ExpiryState = "none" | "current" | "expiring" | "expired";

export interface Expiry {
  state: ExpiryState;
  days: number | null;
  text: string;
}

/** How a document's expiry reads to someone about to file a packet. */
export function expiryOf(c: Pick<CompanyCredential, "expires_on">): Expiry {
  if (!c.expires_on) return { state: "none", days: null, text: "No expiry set" };
  const days = Math.floor(
    (new Date(c.expires_on).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000,
  );
  if (days < 0) {
    return { state: "expired", days, text: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago` };
  }
  if (days <= 30) {
    return { state: "expiring", days, text: days === 0 ? "Expires today" : `Expires in ${days} days` };
  }
  return {
    state: "current",
    days,
    text: `Current until ${new Date(c.expires_on).toLocaleDateString("en-US")}`,
  };
}

/**
 * Supabase rejections are plain objects, not Error instances, so a `catch` that
 * tests `e instanceof Error` shows the caller a generic message and throws the
 * real reason away. Everything here re-throws a real Error carrying the text the
 * database actually sent, and says plainly what a permission refusal means.
 */
function fail(e: unknown, doing: string): never {
  const err = e as { message?: string; code?: string; error?: string; statusCode?: string } | null;
  const code = err?.code ?? err?.statusCode ?? "";
  const raw = err?.message ?? err?.error ?? "";

  // 42501 is Postgres "insufficient privilege"; PGRST301/RLS refusals and the
  // storage API's 403 all mean the same thing to the person at the screen.
  if (code === "42501" || /row-level security|not authorized|permission denied|Unauthorized/i.test(raw)) {
    throw new Error(
      `Your account is not allowed to ${doing}. Company documents can only be changed by an owner or admin of the company.`,
    );
  }
  throw new Error(raw ? `${doing} failed: ${raw}` : `Could not ${doing}.`);
}

export async function listCredentials(companyId: string): Promise<CompanyCredential[]> {
  const { data, error } = await companyCredentials()
    .select("*")
    .eq("company_id", companyId)
    .order("kind");
  if (error) throw error;
  return (data ?? []) as CompanyCredential[];
}

export interface CredentialDraft {
  kind: CredentialKind;
  label?: string | null;
  holder_name?: string | null;
  number?: string | null;
  issuer?: string | null;
  issued_on?: string | null;
  expires_on?: string | null;
  notes?: string | null;
}

/**
 * Upload the file first, then write the row. If the row fails we would rather
 * leave an orphan object in the bucket than a row pointing at a file that was
 * never stored — the second one shows up in a packet as a broken page.
 */
export async function saveCredential(
  companyId: string,
  draft: CredentialDraft,
  file: File | null,
  existing?: CompanyCredential,
): Promise<void> {
  let storagePath = existing?.storage_path ?? null;
  let fileName = existing?.file_name ?? null;
  let mime = existing?.mime_type ?? null;
  let size = existing?.file_size ?? null;

  if (file) {
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${companyId}/credentials/${draft.kind}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("company-assets").upload(path, file);
    if (upErr) fail(upErr, "upload that file");
    storagePath = path;
    fileName = file.name;
    mime = file.type;
    size = file.size;
  }

  const row = {
    company_id: companyId,
    kind: draft.kind,
    label: draft.label || null,
    holder_name: draft.holder_name || null,
    number: draft.number || null,
    issuer: draft.issuer || null,
    issued_on: draft.issued_on || null,
    expires_on: draft.expires_on || null,
    notes: draft.notes || null,
    bucket: "company-assets",
    storage_path: storagePath,
    file_name: fileName,
    mime_type: mime,
    file_size: size,
  };

  if (existing) {
    const { error } = await companyCredentials().update(row).eq("id", existing.id);
    if (error) fail(error, "save that document");
    return;
  }

  /* A company keeps one of each kind in the packet. Replacing a renewed
     certificate is the common case, so a second upload of the same kind
     supersedes the first rather than colliding with the unique index. */
  const { data: prior } = await companyCredentials()
    .select("id")
    .eq("company_id", companyId)
    .eq("kind", draft.kind);
  const priorId = ((prior ?? [])[0] as { id: string } | undefined)?.id;
  if (priorId) {
    const { error } = await companyCredentials().update(row).eq("id", priorId);
    if (error) fail(error, "save that document");
    return;
  }

  const { error } = await companyCredentials().insert({ ...row, is_primary: true });
  if (error) fail(error, "save that document");
}

export async function removeCredential(c: CompanyCredential): Promise<void> {
  if (c.storage_path) {
    await supabase.storage.from(c.bucket || "company-assets").remove([c.storage_path]);
  }
  const { error } = await companyCredentials().delete().eq("id", c.id);
  if (error) fail(error, "remove that document");
}

/** A short-lived link, because the bucket is private on purpose. */
export async function credentialUrl(c: CompanyCredential): Promise<string | null> {
  if (!c.storage_path) return null;
  const { data, error } = await supabase.storage
    .from(c.bucket || "company-assets")
    .createSignedUrl(c.storage_path, 3600);
  if (error) throw error;
  return data?.signedUrl ?? null;
}
