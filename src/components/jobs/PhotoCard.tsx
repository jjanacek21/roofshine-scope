import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Sparkles, Eye, Plus, Trash2, Loader2, Check } from "lucide-react";
import { conditionColor, PHOTO_TAG_LABELS, type PhotoTag } from "@/lib/photo-tags";
import { getTradeColor, getTradeLabel } from "@/lib/trades";

export type PhotoRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  trade_hint: string | null;
  status: string;
  tag: string | null;
  taken_at: string | null;
  exif_gps: { latitude?: number; longitude?: number } | null;
  ai_analysis: Record<string, unknown> & {
    condition_score?: number;
    observed_defects?: string[];
    severity?: string;
    trade_detected?: string;
  };
  matched_line_items: Array<{
    description: string;
    suggested_code?: string;
    suggested_qty?: number;
    unit?: string;
    confidence: string;
  }>;
};

export function PhotoCard({
  photo,
  onView,
  onAnalyze,
  onDelete,
  onAddToEstimate,
  analyzing,
}: {
  photo: PhotoRow;
  onView: () => void;
  onAnalyze: () => void;
  onDelete: () => void;
  onAddToEstimate: () => void;
  analyzing: boolean;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = photo.storage_path.replace(/\.[^.]+$/, "");
      const thumbPath = `${base}_thumb.jpg`;
      const { data: thumb } = await supabase.storage
        .from("roof-photos")
        .createSignedUrl(thumbPath, 3600);
      if (thumb?.signedUrl && !cancelled) {
        setThumbUrl(thumb.signedUrl);
        return;
      }
      const { data: full } = await supabase.storage
        .from("roof-photos")
        .createSignedUrl(photo.storage_path, 3600);
      if (full?.signedUrl && !cancelled) setThumbUrl(full.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [photo.storage_path]);

  const analyzed = photo.status === "analyzed";
  const score = photo.ai_analysis?.condition_score;
  const defects = photo.ai_analysis?.observed_defects ?? [];
  const trade = photo.ai_analysis?.trade_detected ?? photo.trade_hint;

  return (
    <div
      className="group overflow-hidden rounded-xl border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface)]">
        {thumbUrl ? (
          <img src={thumbUrl} alt={photo.caption ?? ""} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full animate-pulse bg-[var(--surface)]" />
        )}
        {photo.tag && (
          <span
            className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur"
          >
            {PHOTO_TAG_LABELS[photo.tag as PhotoTag] ?? photo.tag}
          </span>
        )}
        {analyzed && (
          <span className="absolute right-2 top-2 rounded-full bg-green-500/90 p-1 text-white">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          {trade ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                backgroundColor: `${getTradeColor(trade)}22`,
                color: getTradeColor(trade),
              }}
            >
              {getTradeLabel(trade)}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {photo.status}
            </span>
          )}
          {score != null && (
            <span
              className="font-mono-num text-lg font-bold"
              style={{ color: conditionColor(score) }}
            >
              {score}
            </span>
          )}
        </div>

        {defects.length > 0 ? (
          <p className="line-clamp-2 text-[11px] text-muted-foreground">
            {defects.join(", ")}
          </p>
        ) : (
          <p className="text-[11px] italic text-muted-foreground/60">
            {analyzed ? "No defects observed" : "Not yet analyzed"}
          </p>
        )}

        <div className="flex items-center gap-1 pt-1">
          <button
            onClick={onView}
            className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border text-[11px] hover:bg-[var(--surface-hover)]"
            style={{ borderColor: "var(--border)" }}
          >
            <Eye className="h-3 w-3" /> View
          </button>
          {analyzed ? (
            <button
              onClick={onAddToEstimate}
              className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border text-[11px] hover:bg-[var(--surface-hover)]"
              style={{ borderColor: "var(--border)" }}
            >
              <Plus className="h-3 w-3" /> Estimate
            </button>
          ) : (
            <button
              onClick={onAnalyze}
              disabled={analyzing}
              className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border text-[11px] hover:bg-[var(--surface-hover)] disabled:opacity-40"
              style={{ borderColor: "var(--border)" }}
            >
              {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Analyze
            </button>
          )}
          <button
            onClick={onDelete}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground hover:text-red-400"
            style={{ borderColor: "var(--border)" }}
            aria-label="Delete photo"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
