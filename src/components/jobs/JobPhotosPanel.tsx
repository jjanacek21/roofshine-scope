import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Camera, Loader2, Sparkles, Trash2, ImageIcon } from "lucide-react";

type Photo = {
  id: string;
  storage_path: string;
  caption: string | null;
  trade_hint: string | null;
  status: string;
  ai_analysis: Record<string, unknown>;
  matched_line_items: Array<{
    description: string;
    suggested_code?: string;
    suggested_qty?: number;
    unit?: string;
    confidence: string;
    needs_user_input?: string[];
  }>;
};

export function JobPhotosPanel({ jobId }: { jobId: string }) {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const { data: photos = [] } = useQuery({
    queryKey: ["job-photos", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as Photo[];
      // Sign URLs in parallel
      const urls: Record<string, string> = {};
      await Promise.all(
        list.map(async (p) => {
          const { data: s } = await supabase.storage
            .from("roof-photos")
            .createSignedUrl(p.storage_path, 3600);
          if (s?.signedUrl) urls[p.id] = s.signedUrl;
        }),
      );
      setSignedUrls(urls);
      return list;
    },
  });

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      if (!profile?.company_id) throw new Error("No company");
      const ts = Date.now();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${profile.company_id}/${jobId}/${ts}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("roof-photos").upload(path, f, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("job_photos").insert({
          job_id: jobId,
          company_id: profile.company_id,
          uploaded_by: profile.id,
          storage_path: path,
        });
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Photos uploaded");
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const analyze = useMutation({
    mutationFn: async (photoId: string) => {
      const { data: s } = await supabase.auth.getSession();
      const accessToken = s.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const r = await fetch("/api/analyze-job-photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ photo_id: photoId }),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || "AI analysis failed");
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Analysis complete");
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const del = useMutation({
    mutationFn: async (p: Photo) => {
      await supabase.storage.from("roof-photos").remove([p.storage_path]);
      await supabase.from("job_photos").delete().eq("id", p.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Job Photos ({photos.length})
        </h2>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold disabled:opacity-40"
        >
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          Upload Photos
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) upload.mutate(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {photos.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl border p-12 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No photos yet — upload to start AI analysis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              {signedUrls[p.id] ? (
                <img src={signedUrls[p.id]} alt={p.caption ?? ""} className="h-44 w-full object-cover" />
              ) : (
                <div className="h-44 w-full animate-pulse bg-[var(--surface)]" />
              )}
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                    style={{
                      color: p.status === "analyzed" ? "var(--brand)" : "var(--muted-foreground)",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    {p.status}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => analyze.mutate(p.id)}
                      disabled={analyze.isPending}
                      className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] hover:bg-[var(--surface-hover)] disabled:opacity-40"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Analyze
                    </button>
                    <button
                      onClick={() => del.mutate(p)}
                      className="inline-flex h-7 items-center justify-center rounded-md border px-2 text-muted-foreground hover:text-red-400"
                      style={{ borderColor: "var(--border)" }}
                      aria-label="Delete photo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {p.matched_line_items?.length > 0 && (
                  <div className="space-y-1">
                    {p.matched_line_items.slice(0, 4).map((m, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {m.suggested_code ? `[${m.suggested_code}] ` : ""}
                          {m.description}
                        </span>
                        {m.suggested_qty && m.unit && (
                          <span className="ml-1 font-mono-num">
                            · {m.suggested_qty} {m.unit}
                          </span>
                        )}
                        <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">
                          {m.confidence}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
