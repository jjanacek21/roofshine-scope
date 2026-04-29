import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, Check, X, Pencil, Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export type PhotoDecisionRow = {
  id: string;
  job_id: string;
  company_id: string;
  photo_id: string | null;
  estimate_id: string | null;
  suggested_code: string;
  suggested_qty: number | null;
  suggested_unit: string | null;
  ai_confidence: "low" | "medium" | "high" | null;
  ai_description: string | null;
  source_photo_ids: string[] | null;
  decision: "picked" | "rejected" | "edited";
  final_code: string | null;
  final_qty: number | null;
  final_unit: string | null;
  trade: string | null;
  asset_type: string | null;
  decided_by: string | null;
  decided_at: string;
  reviewed_by_admin: string | null;
  reviewed_at: string | null;
};

export type PhotoSession = {
  job_id: string;
  date: string; // YYYY-MM-DD
  decided_at: string; // first/most-recent timestamp in the session
  address: string | null;
  company_name: string | null;
  decisions: PhotoDecisionRow[];
};

function PhotoThumb({ photoId }: { photoId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: photo } = await supabase
        .from("job_photos")
        .select("storage_path")
        .eq("id", photoId)
        .maybeSingle();
      if (!photo) return;
      const base = photo.storage_path.replace(/\.[^.]+$/, "");
      const { data: thumb } = await supabase.storage
        .from("roof-photos")
        .createSignedUrl(`${base}_thumb.jpg`, 3600);
      if (thumb?.signedUrl && !cancelled) {
        setUrl(thumb.signedUrl);
        return;
      }
      const { data: full } = await supabase.storage
        .from("roof-photos")
        .createSignedUrl(photo.storage_path, 3600);
      if (full?.signedUrl && !cancelled) setUrl(full.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [photoId]);
  return (
    <div
      className="h-12 w-12 shrink-0 overflow-hidden rounded border bg-[var(--surface)]"
      style={{ borderColor: "var(--border)" }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
    </div>
  );
}

const decisionStyle: Record<string, string> = {
  picked: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
  edited: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const decisionIcon = {
  picked: Check,
  rejected: X,
  edited: Pencil,
} as const;

export function PhotoDecisionsDrawer({
  session,
  open,
  onClose,
  onChanged,
}: {
  session: PhotoSession | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [marking, setMarking] = useState(false);
  if (!session) return null;

  const reviewedCount = session.decisions.filter((d) => d.reviewed_at).length;
  const allReviewed = reviewedCount === session.decisions.length;

  const markReviewed = async () => {
    setMarking(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const ids = session.decisions.map((d) => d.id);
      const { error } = await supabase
        .from("photo_suggestion_decisions")
        .update({ reviewed_at: new Date().toISOString(), reviewed_by_admin: userRes.user?.id ?? null })
        .in("id", ids);
      if (error) throw error;
      toast.success("Marked as reviewed");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark reviewed");
    } finally {
      setMarking(false);
    }
  };

  const exportJson = async () => {
    const snapshot = {
      job_id: session.job_id,
      address: session.address,
      company: session.company_name,
      decided_at: session.decided_at,
      decisions: session.decisions.map((d) => ({
        suggested: {
          code: d.suggested_code,
          qty: d.suggested_qty,
          unit: d.suggested_unit,
          confidence: d.ai_confidence,
          description: d.ai_description,
          trade: d.trade,
          asset_type: d.asset_type,
        },
        decision: d.decision,
        final:
          d.decision === "rejected"
            ? null
            : { code: d.final_code, qty: d.final_qty, unit: d.final_unit },
      })),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      toast.success("Training row copied to clipboard");
    } catch {
      toast.error("Clipboard not available");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{session.address ?? "Photo analysis session"}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {session.company_name && (
              <span className="rounded bg-muted px-1.5 py-0.5">{session.company_name}</span>
            )}
            <span>{new Date(session.decided_at).toLocaleString()}</span>
            <span>· {session.decisions.length} suggestions</span>
            {allReviewed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> Reviewed
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          <button
            onClick={markReviewed}
            disabled={marking || allReviewed}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Mark reviewed
          </button>
          <button
            onClick={exportJson}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-accent/30"
            style={{ borderColor: "var(--border)" }}
          >
            <Copy className="h-3.5 w-3.5" /> Export training row
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {session.decisions.map((d) => {
            const Icon = decisionIcon[d.decision];
            return (
              <div
                key={d.id}
                className="rounded-md border p-3"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              >
                <div className="flex items-start gap-3">
                  {(d.source_photo_ids ?? []).slice(0, 3).map((pid) => (
                    <PhotoThumb key={pid} photoId={pid} />
                  ))}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-xs font-semibold">{d.suggested_code}</span>
                      <span className="text-sm">{d.ai_description ?? "—"}</span>
                      {d.ai_confidence && (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] uppercase">
                          {d.ai_confidence}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">
                        {d.suggested_qty ?? "?"} {d.suggested_unit ?? ""}
                      </span>
                      {d.trade && <span>· {d.trade}</span>}
                      {d.asset_type && <span>· {d.asset_type}</span>}
                    </div>
                    {d.decision === "edited" && (
                      <div className="mt-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px]">
                        User used:{" "}
                        <span className="font-mono">
                          {d.final_code ?? "—"} · {d.final_qty ?? "?"} {d.final_unit ?? ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${decisionStyle[d.decision]}`}
                  >
                    <Icon className="h-3 w-3" /> {d.decision}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
