import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { PHOTO_TAGS, PHOTO_TAG_LABELS, conditionColor, type PhotoTag } from "@/lib/photo-tags";
import type { PhotoRow } from "./PhotoCard";

export function PhotoLightbox({
  photo,
  onClose,
  onUpdated,
  onReAnalyze,
  onAddToEstimate,
  analyzing,
}: {
  photo: PhotoRow | null;
  onClose: () => void;
  onUpdated: () => void;
  onReAnalyze: (id: string) => void;
  onAddToEstimate: (p: PhotoRow) => void;
  analyzing: boolean;
}) {
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [tag, setTag] = useState<string>(photo?.tag ?? "");
  const [caption, setCaption] = useState<string>(photo?.caption ?? "");
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    if (!photo) return;
    setTag(photo.tag ?? "");
    setCaption(photo.caption ?? "");
    setFullUrl(null);
    (async () => {
      const { data } = await supabase.storage
        .from("roof-photos")
        .createSignedUrl(photo.storage_path, 3600);
      if (data?.signedUrl) setFullUrl(data.signedUrl);
    })();
  }, [photo]);

  if (!photo) return null;

  const saveMeta = async () => {
    setSavingMeta(true);
    await supabase
      .from("job_photos")
      .update({ tag: tag || null, caption: caption || null })
      .eq("id", photo.id);
    setSavingMeta(false);
    onUpdated();
  };

  const ai = photo.ai_analysis ?? {};
  const score = ai.condition_score;
  const defects = ai.observed_defects ?? [];
  const severity = ai.severity;
  const items = photo.matched_line_items ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl p-0">
        <div className="grid h-[80vh] grid-cols-1 lg:grid-cols-[3fr_2fr]">
          <div className="flex items-center justify-center bg-black">
            {fullUrl ? (
              <img src={fullUrl} alt={photo.caption ?? ""} className="max-h-full max-w-full object-contain" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            )}
          </div>
          <div className="overflow-y-auto p-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tag</label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onBlur={saveMeta}
                className="mt-1 h-9 w-full rounded-md border bg-[var(--bg-elevated)] px-2 text-sm text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">— untagged —</option>
                {PHOTO_TAGS.map((t) => (
                  <option key={t} value={t}>{PHOTO_TAG_LABELS[t as PhotoTag]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onBlur={saveMeta}
                rows={3}
                className="mt-1 w-full rounded-md border bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-foreground"
                style={{ borderColor: "var(--border)" }}
                placeholder="Add notes for this photo…"
              />
              {savingMeta && <p className="mt-1 text-[10px] text-muted-foreground">Saving…</p>}
            </div>

            {photo.status === "analyzed" ? (
              <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI Analysis</h3>
                  {score != null && (
                    <span className="font-mono-num text-2xl font-bold" style={{ color: conditionColor(score) }}>
                      {score}
                    </span>
                  )}
                </div>
                {severity && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Severity:</span>{" "}
                    <span className="font-semibold capitalize text-foreground">{severity}</span>
                  </p>
                )}
                {defects.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Defects</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-foreground">
                      {defects.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}
                {items.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Suggested Line Items</p>
                    <table className="mt-1 w-full text-[11px]">
                      <tbody>
                        {items.map((it, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                            <td className="py-1 pr-2 font-mono-num text-muted-foreground">{it.suggested_code ?? "—"}</td>
                            <td className="py-1 pr-2 text-foreground">{it.description}</td>
                            <td className="py-1 pr-2 font-mono-num text-right text-muted-foreground">
                              {it.suggested_qty ? `${it.suggested_qty} ${it.unit ?? ""}` : "—"}
                            </td>
                            <td className="py-1 text-[10px] uppercase opacity-60">{it.confidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground" style={{ borderColor: "var(--border)" }}>
                Not yet analyzed.
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => onReAnalyze(photo.id)}
                disabled={analyzing}
                className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold hover:bg-[var(--surface-hover)] disabled:opacity-40"
                style={{ borderColor: "var(--border)" }}
              >
                {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {photo.status === "analyzed" ? "Re-analyze" : "Analyze"}
              </button>
              {photo.status === "analyzed" && items.length > 0 && (
                <button
                  onClick={() => onAddToEstimate(photo)}
                  className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add suggestions to estimate
                </button>
              )}
            </div>

            {photo.exif_gps?.latitude != null && (
              <p className="text-[10px] font-mono-num text-muted-foreground">
                GPS: {photo.exif_gps.latitude.toFixed(5)}, {photo.exif_gps.longitude?.toFixed(5)}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
