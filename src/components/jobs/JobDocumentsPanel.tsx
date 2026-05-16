import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  FileSignature,
  ClipboardList,
  Ruler,
  FileBadge,
  UploadCloud,
  Download,
  ExternalLink,
  Trash2,
  Loader2,
  File as FileIcon,
} from "lucide-react";

type Kind =
  | "measurement_report"
  | "work_order"
  | "contract"
  | "contingency"
  | "completed_report"
  | "upload"
  | "other";

type DocRow = {
  id: string;
  kind: Kind;
  title: string;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  source_id: string | null;
  // virtual marker if row comes from external table (contracts/generated_reports)
  external?: "contract" | "generated_report";
  publicUrl?: string | null;
};

const SECTIONS: { kind: Kind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "measurement_report", label: "Measurement Reports", icon: Ruler },
  { kind: "work_order", label: "Work Orders", icon: ClipboardList },
  { kind: "contract", label: "Contracts", icon: FileSignature },
  { kind: "contingency", label: "Contingencies", icon: FileSignature },
  { kind: "completed_report", label: "Completed Reports", icon: FileBadge },
  { kind: "upload", label: "Uploads", icon: FileText },
  { kind: "other", label: "Other", icon: FileIcon },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JobDocumentsPanel({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: companyId } = useQuery({
    queryKey: ["my-company-id"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", u.user.id)
        .maybeSingle();
      return data?.company_id ?? null;
    },
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["job-documents-all", jobId],
    queryFn: async () => {
      const [{ data: jd }, { data: contracts }, { data: reports }] = await Promise.all([
        supabase
          .from("job_documents")
          .select("*")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false }),
        supabase
          .from("contracts")
          .select("id, document_id, contract_type, pdf_url, signed_at, created_at")
          .eq("job_id", jobId),
        supabase
          .from("generated_reports")
          .select("id, pdf_path, created_at")
          .eq("job_id", jobId),
      ]);

      const all: DocRow[] = [];
      const seenContract = new Set<string>();
      const seenReport = new Set<string>();
      for (const d of jd ?? []) {
        all.push(d as DocRow);
        if (d.source_table === "contracts" && d.source_id) seenContract.add(d.source_id);
        if (d.source_table === "generated_reports" && d.source_id) seenReport.add(d.source_id);
      }
      for (const c of contracts ?? []) {
        if (seenContract.has(c.id)) continue;
        all.push({
          id: `c-${c.id}`,
          kind: c.contract_type === "insurance" ? "contingency" : "contract",
          title: c.document_id,
          bucket: "contracts",
          storage_path: "",
          mime_type: "application/pdf",
          file_size: null,
          created_at: c.signed_at ?? c.created_at,
          source_id: c.id,
          external: "contract",
          publicUrl: c.pdf_url,
        });
      }
      for (const r of reports ?? []) {
        if (seenReport.has(r.id)) continue;
        all.push({
          id: `r-${r.id}`,
          kind: "completed_report",
          title: r.pdf_path.split("/").pop() ?? "Report",
          bucket: "generated-pdfs",
          storage_path: r.pdf_path,
          mime_type: "application/pdf",
          file_size: null,
          created_at: r.created_at,
          source_id: r.id,
          external: "generated_report",
        });
      }
      all.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      return all;
    },
  });

  const grouped = useMemo(() => {
    const m = new Map<Kind, DocRow[]>();
    for (const s of SECTIONS) m.set(s.kind, []);
    for (const d of docs) {
      if (!m.has(d.kind)) m.set("other", [...(m.get("other") ?? []), d]);
      else m.get(d.kind)!.push(d);
    }
    return m;
  }, [docs]);

  async function openDoc(d: DocRow) {
    try {
      if (d.publicUrl) {
        window.open(d.publicUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const { data, error } = await supabase.storage
        .from(d.bucket)
        .createSignedUrl(d.storage_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function downloadDoc(d: DocRow) {
    try {
      let url: string | null = d.publicUrl ?? null;
      if (!url) {
        const { data, error } = await supabase.storage
          .from(d.bucket)
          .createSignedUrl(d.storage_path, 3600);
        if (error) throw error;
        url = data?.signedUrl ?? null;
      }
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = d.title;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const delMutation = useMutation({
    mutationFn: async (d: DocRow) => {
      if (d.external) throw new Error("Open the originating record to delete this file.");
      await supabase.storage.from(d.bucket).remove([d.storage_path]);
      const { error } = await supabase.from("job_documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-documents-all", jobId] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    if (!companyId) {
      toast.error("No company linked to your account.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Max file size is 25 MB.");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${companyId}/${jobId}/${crypto.randomUUID()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("job-documents")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("job_documents").insert({
        job_id: jobId,
        company_id: companyId,
        kind: "upload",
        title: file.name,
        bucket: "job-documents",
        storage_path: path,
        mime_type: file.type || null,
        file_size: file.size,
        created_by: u.user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["job-documents-all", jobId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-foreground">Documents</h2>
          <p className="text-[12px] text-muted-foreground">
            All files attached to this job — generated reports, contracts, work orders, and uploads.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-brand inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Upload
        </button>
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-[var(--bg-card)]" />
          <div className="h-20 animate-pulse rounded-xl bg-[var(--bg-card)]" />
        </div>
      ) : docs.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl border p-10 text-center"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-[13px] text-foreground">No documents yet</p>
          <p className="text-[12px] text-muted-foreground">
            Generate a report, sign a contract, or upload a file to get started.
          </p>
        </div>
      ) : (
        SECTIONS.map((s) => {
          const items = grouped.get(s.kind) ?? [];
          if (items.length === 0) return null;
          const Icon = s.icon;
          return (
            <div
              key={s.kind}
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
            >
              <h3 className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {s.label}
                <span className="font-mono-num text-foreground">({items.length})</span>
              </h3>
              <ul className="space-y-2">
                {items.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-[13px] font-semibold text-foreground">{d.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDate(d.created_at)}
                        {d.file_size ? ` · ${fmtSize(d.file_size)}` : ""}
                        {d.mime_type ? ` · ${d.mime_type}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openDoc(d)}
                        className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
                      >
                        <ExternalLink className="h-3 w-3" strokeWidth={2.4} />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadDoc(d)}
                        className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
                      >
                        <Download className="h-3 w-3" strokeWidth={2.4} />
                        Download
                      </button>
                      {!d.external && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete "${d.title}"?`)) delMutation.mutate(d);
                          }}
                          className="btn-ghost inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-red-500"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2.4} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
