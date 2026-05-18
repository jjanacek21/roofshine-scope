import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Resolve a list of storage paths (in report-assets) to short-lived signed URLs. */
export function useSignedUrls(items: Array<{ bucket?: string | null; path?: string | null } | null | undefined>) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = items
    .map((i) => (i?.path ? `${i.bucket ?? "report-assets"}:${i.path}` : ""))
    .join("|");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const it of items) {
        if (!it?.path) continue;
        const bucket = it.bucket ?? "report-assets";
        const { data } = await supabase.storage.from(bucket).createSignedUrl(it.path, 3600);
        if (data?.signedUrl) out[it.path] = data.signedUrl;
      }
      if (!cancelled) setUrls(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

export async function uploadReportAsset({
  file,
  companyId,
  jobId,
  kind,
}: {
  file: File;
  companyId: string;
  jobId: string;
  kind: "upload" | "video";
}): Promise<{
  id: string;
  storage_path: string;
  bucket: string;
  mime_type: string;
}> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${companyId}/${jobId}/${kind}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("report-assets").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: u } = await supabase.auth.getUser();
  const { data: row, error: insErr } = await supabase
    .from("report_assets")
    .insert({
      company_id: companyId,
      job_id: jobId,
      kind,
      storage_path: path,
      bucket: "report-assets",
      mime_type: file.type,
      file_size: file.size,
      meta: { original_name: file.name },
      created_by: u.user?.id ?? null,
    })
    .select("id, storage_path, bucket, mime_type")
    .single();
  if (insErr) throw insErr;
  return row as { id: string; storage_path: string; bucket: string; mime_type: string };
}
