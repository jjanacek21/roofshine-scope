import { supabase } from "@/integrations/supabase/client";

/**
 * Filing a file into the job's Documents tab.
 *
 * Anything produced for a job — a signed contract, a filled permit
 * application, a recorded NOC, a completed report — should be findable in one
 * place afterwards. Before this existed each producer wrote its own insert, so
 * some filed and some didn't, and the Documents tab quietly showed a subset of
 * what the job actually had.
 *
 * Every producer now calls this. It is deliberately forgiving: filing is a
 * side effect of the real work, so a failure here is logged and swallowed
 * rather than failing the upload the user actually asked for. The database
 * carries a unique index on (job_id, bucket, storage_path), so calling it twice
 * for the same file is harmless.
 */

export type JobDocumentKind =
  | "measurement_report"
  | "work_order"
  | "contract"
  | "contingency"
  | "completed_report"
  | "permit"
  | "upload"
  | "other";

export interface FileJobDocumentInput {
  jobId: string;
  companyId: string;
  kind: JobDocumentKind;
  title: string;
  /** Storage bucket the file already lives in. Nothing is copied. */
  bucket: string;
  storagePath: string;
  mimeType?: string | null;
  fileSize?: number | null;
  /** The record this file belongs to, so the row can be traced back. */
  sourceTable?: string | null;
  sourceId?: string | null;
}

/**
 * Returns true when the file is now listed on the job. Never throws — see
 * above; the caller's own work has already succeeded by the time this runs.
 */
export async function fileJobDocument(input: FileJobDocumentInput): Promise<boolean> {
  if (!input.jobId || !input.companyId || !input.storagePath) return false;
  try {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("job_documents").insert({
      job_id: input.jobId,
      company_id: input.companyId,
      kind: input.kind,
      title: input.title,
      bucket: input.bucket,
      storage_path: input.storagePath,
      mime_type: input.mimeType ?? null,
      file_size: input.fileSize ?? null,
      source_table: input.sourceTable ?? null,
      source_id: input.sourceId ?? null,
      created_by: user.user?.id ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (error) {
      /* 23505 is the unique index doing its job — the file is already listed,
         which is the outcome the caller wanted. */
      if ((error as { code?: string }).code === "23505") return true;
      throw error;
    }
    return true;
  } catch (e) {
    console.warn("could not file into the job documents", e);
    return false;
  }
}

/** The company the signed-in user files documents for. */
export async function currentCompanyId(): Promise<string | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.user.id)
    .maybeSingle();
  return (data as { company_id?: string } | null)?.company_id ?? null;
}
