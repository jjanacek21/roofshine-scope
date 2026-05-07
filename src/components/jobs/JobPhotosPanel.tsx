import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageIcon, CheckSquare, X, Trash2, Loader2 } from "lucide-react";
import { PhotoUploader } from "./PhotoUploader";
import { PhotoFilterBar, DEFAULT_FILTERS, type PhotoFilters } from "./PhotoFilterBar";
import { PhotoCard, type PhotoRow } from "./PhotoCard";
import { PhotoLightbox } from "./PhotoLightbox";
import { PropertyAnalysisPanel } from "./PropertyAnalysisPanel";

export function JobPhotosPanel({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PhotoFilters>(DEFAULT_FILTERS);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const { data: photos = [] } = useQuery({
    queryKey: ["job-photos", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_photos")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as PhotoRow[];
    },
  });

  const filtered = useMemo(() => {
    return photos.filter((p) => {
      if (filters.tag !== "all" && p.tag !== filters.tag) return false;
      if (filters.trade !== "all") {
        const trade = p.ai_analysis?.trade_detected ?? p.trade_hint;
        if (trade !== filters.trade) return false;
      }
      if (filters.analyzed === "analyzed" && p.status !== "analyzed") return false;
      if (filters.analyzed === "unanalyzed" && p.status === "analyzed") return false;
      return true;
    });
  }, [photos, filters]);

  const unanalyzedCount = photos.filter((p) => p.status !== "analyzed").length;
  const lightboxPhoto = photos.find((p) => p.id === lightboxId) ?? null;

  const callAnalyze = async (photoId: string) => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (!token) throw new Error("Not authenticated");
    const r = await fetch("/api/analyze-job-photos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ photo_id: photoId }),
    });
    if (!r.ok) throw new Error((await r.text()) || "AI analysis failed");
    return r.json();
  };

  const analyze = useMutation({
    mutationFn: async (photoId: string) => {
      setAnalyzingId(photoId);
      try {
        return await callAnalyze(photoId);
      } finally {
        setAnalyzingId(null);
      }
    },
    onSuccess: () => {
      toast.success("Analysis complete");
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const analyzeAll = useMutation({
    mutationFn: async () => {
      const targets = photos.filter((p) => p.status !== "analyzed");
      for (const p of targets) {
        try {
          setAnalyzingId(p.id);
          await callAnalyze(p.id);
        } catch (e) {
          console.error("analyze failed", p.id, e);
        }
      }
      setAnalyzingId(null);
      return targets.length;
    },
    onSuccess: (n) => {
      toast.success(`Analyzed ${n} photo${n === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Batch analysis failed"),
  });

  const del = useMutation({
    mutationFn: async (p: PhotoRow) => {
      const base = p.storage_path.replace(/\.[^.]+$/, "");
      await supabase.storage.from("roof-photos").remove([p.storage_path, `${base}_thumb.jpg`]);
      await supabase.from("job_photos").delete().eq("id", p.id);
    },
    onSuccess: () => {
      toast.success("Photo deleted");
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const targets = photos.filter((p) => ids.includes(p.id));
      const paths = targets.flatMap((p) => {
        const base = p.storage_path.replace(/\.[^.]+$/, "");
        return [p.storage_path, `${base}_thumb.jpg`];
      });
      if (paths.length) await supabase.storage.from("roof-photos").remove(paths);
      await supabase.from("job_photos").delete().in("id", ids);
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`Deleted ${n} photo${n === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
      exitSelect();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Bulk delete failed"),
  });

  const handleAddToEstimate = (p?: PhotoRow) => {
    const photo = p ?? lightboxPhoto;
    const codes = (photo?.matched_line_items ?? [])
      .map((it) => it.suggested_code)
      .filter((c): c is string => !!c);
    if (codes.length === 0) {
      toast.info("No suggested codes on this photo yet");
      return;
    }
    navigate({
      to: "/jobs/$id/estimate",
      params: { id: jobId },
      search: { codes: codes.join(",") },
    });
  };

  return (
    <div className="space-y-4">
      <PhotoUploader jobId={jobId} />

      <PropertyAnalysisPanel jobId={jobId} photoCount={photos.length} />

      {photos.length > 0 && (
        <PhotoFilterBar
          filters={filters}
          onChange={setFilters}
          count={filtered.length}
          onAnalyzeAll={() => analyzeAll.mutate()}
          analyzeAllPending={analyzeAll.isPending}
          unanalyzedCount={unanalyzedCount}
        />
      )}

      {photos.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {selectMode ? `${selectedIds.size} selected` : `${filtered.length} photo${filtered.length === 1 ? "" : "s"}`}
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <button
                  onClick={() => setSelectedIds(new Set(filtered.map((p) => p.id)))}
                  className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  Clear
                </button>
                <button
                  onClick={exitSelect}
                  className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedIds.size === 0) return;
                    if (confirm(`Delete ${selectedIds.size} photo${selectedIds.size === 1 ? "" : "s"}?`)) {
                      bulkDelete.mutate(Array.from(selectedIds));
                    }
                  }}
                  disabled={selectedIds.size === 0 || bulkDelete.isPending}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-red-500/90 px-3 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
                >
                  {bulkDelete.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Delete{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs hover:bg-[var(--surface-hover)]"
                style={{ borderColor: "var(--border)" }}
              >
                <CheckSquare className="h-3 w-3" /> Select
              </button>
            )}
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-xl border p-12 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No photos yet — upload to start AI analysis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              onView={() => setLightboxId(p.id)}
              onAnalyze={() => analyze.mutate(p.id)}
              onDelete={() => {
                if (confirm("Delete this photo?")) del.mutate(p);
              }}
              onAddToEstimate={() => handleAddToEstimate(p)}
              analyzing={analyzingId === p.id}
              selectable={selectMode}
              selected={selectedIds.has(p.id)}
              onToggleSelect={() => toggleSelect(p.id)}
            />
          ))}
        </div>
      )}

      <PhotoLightbox
        photo={lightboxPhoto}
        onClose={() => setLightboxId(null)}
        onUpdated={() => qc.invalidateQueries({ queryKey: ["job-photos", jobId] })}
        onReAnalyze={(id) => analyze.mutate(id)}
        onAddToEstimate={handleAddToEstimate}
        analyzing={analyzingId === lightboxPhoto?.id}
      />
    </div>
  );
}
