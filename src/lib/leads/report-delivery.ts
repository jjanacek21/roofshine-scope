import { supabase } from "@/integrations/supabase/client";

/**
 * Report delivery tracking.
 *
 * Every report a rep sends out is stored twice: the PDF itself goes into the
 * `lead-reports` bucket so there is a permanent copy on the lead, and a row in
 * `lead_reports` records who it went to and when.
 *
 * The delivery record lives inside the row's existing `inputs` JSON rather than
 * in dedicated columns. That keeps report tracking on the same schema the app
 * already runs on — no migration, no schema drift between environments — and
 * `inputs` is exactly the place the row was designed to carry the specifics of
 * one report.
 */

export const REPORTS_BUCKET = "lead-reports";

export type DeliveryMethod = "email" | "download" | "hand" | "text";

export type ReportDelivery = {
  /** ISO timestamp the report left the building. */
  sent_at: string;
  method: DeliveryMethod;
  recipient_name: string | null;
  recipient_email: string | null;
  /** Contact row this went to, when it was picked from the lead's contacts. */
  contact_id: string | null;
  /** Last time someone re-opened the stored copy. */
  downloaded_at?: string | null;
};

export type LeadReportRow = {
  id: string;
  lead_id: string;
  company_id: string;
  kind: string;
  name: string;
  pdf_path: string;
  created_at: string;
  inputs: unknown;
};

/** Pull the delivery record out of a row's `inputs`, tolerating older rows. */
export function readDelivery(inputs: unknown): ReportDelivery | null {
  if (!inputs || typeof inputs !== "object") return null;
  const d = (inputs as Record<string, unknown>).delivery;
  if (!d || typeof d !== "object") return null;
  const rec = d as Record<string, unknown>;
  if (typeof rec.sent_at !== "string") return null;
  return {
    sent_at: rec.sent_at,
    method: (rec.method as DeliveryMethod) ?? "download",
    recipient_name: (rec.recipient_name as string) ?? null,
    recipient_email: (rec.recipient_email as string) ?? null,
    contact_id: (rec.contact_id as string) ?? null,
    downloaded_at: (rec.downloaded_at as string) ?? null,
  };
}

export const METHOD_LABELS: Record<DeliveryMethod, string> = {
  email: "Emailed",
  download: "Downloaded",
  hand: "Hand delivered",
  text: "Texted",
};

export type SaveReportArgs = {
  leadId: string;
  companyId: string;
  /** Report family, e.g. "savings" or "ai_roof". */
  kind: string;
  /** Human-readable name shown on the lead. */
  name: string;
  blob: Blob;
  /** Basename for the stored file; a timestamp and .pdf are appended. */
  filenameHint: string;
  delivery: Omit<ReportDelivery, "sent_at"> & { sent_at?: string };
  /** Extra context worth keeping with the report (sqft, roof type, totals…). */
  context?: Record<string, unknown>;
  /** Advance the lead to Report sent. Off for an internal-only copy. */
  advanceStatus?: boolean;
};

export type SaveReportResult = {
  ok: boolean;
  path?: string;
  error?: string;
};

/**
 * Store a generated report against its lead and record the delivery.
 *
 * Best-effort by design: the rep already has the PDF in hand by the time this
 * runs, so a storage hiccup must never look like the report failed. Callers
 * surface the returned error as a warning, not a failure.
 */
export async function saveLeadReport(args: SaveReportArgs): Promise<SaveReportResult> {
  const {
    leadId,
    companyId,
    kind,
    name,
    blob,
    filenameHint,
    delivery,
    context,
    advanceStatus = true,
  } = args;

  const safe =
    filenameHint
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 60) || "report";
  const path = `${companyId}/${leadId}/${safe}-${Date.now()}.pdf`;

  const { error: upErr } = await supabase.storage
    .from(REPORTS_BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (upErr) return { ok: false, error: upErr.message };

  const record: ReportDelivery = {
    sent_at: delivery.sent_at ?? new Date().toISOString(),
    method: delivery.method,
    recipient_name: delivery.recipient_name,
    recipient_email: delivery.recipient_email,
    contact_id: delivery.contact_id,
    downloaded_at: null,
  };

  const { error: insErr } = await supabase.from("lead_reports").insert({
    lead_id: leadId,
    company_id: companyId,
    kind,
    name,
    pdf_path: path,
    // The generated Json type does not accept a structural object literal, so
    // this round-trips through the shape the column actually stores.
    inputs: JSON.parse(JSON.stringify({ delivery: record, ...(context ? { context } : {}) })),
  });
  if (insErr) return { ok: false, error: insErr.message };

  const who = record.recipient_name || record.recipient_email;
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    type: "report_sent",
    note: who
      ? `${METHOD_LABELS[record.method]} to ${who}`
      : `${METHOD_LABELS[record.method]} — no recipient recorded`,
  });

  if (advanceStatus) {
    // Only move a lead forward. A won deal does not go back to Report sent
    // because someone re-sent a copy of the report.
    const { data: lead } = await supabase
      .from("leads")
      .select("status")
      .eq("id", leadId)
      .maybeSingle();
    const behind = lead?.status === "prospect" || lead?.status === "contacted";
    if (behind) await supabase.from("leads").update({ status: "report_sent" }).eq("id", leadId);
  }

  return { ok: true, path };
}

/** Open a stored report and stamp the row as downloaded. */
export async function openStoredReport(row: LeadReportRow, filename?: string) {
  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(row.pdf_path, 60 * 5, { download: filename ?? `${row.name}.pdf` });
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not open the report");

  const existing = readDelivery(row.inputs);
  if (existing) {
    const base = (row.inputs && typeof row.inputs === "object" ? row.inputs : {}) as Record<
      string,
      unknown
    >;
    await supabase
      .from("lead_reports")
      .update({
        inputs: { ...base, delivery: { ...existing, downloaded_at: new Date().toISOString() } },
      })
      .eq("id", row.id);
  }

  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}
