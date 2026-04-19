import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Check, X } from "lucide-react";
import { useState } from "react";

export type AISuggestion = {
  photo_id: string;
  description: string;
  suggested_code?: string;
  suggested_qty?: number;
  unit?: string;
  confidence: string;
};

export function AISuggestionsPanel({
  jobId, onApprove,
}: {
  jobId: string;
  onApprove: (items: Array<{ code: string; qty: number }>) => Promise<void> | void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const { data: suggestions = [] } = useQuery({
    queryKey: ["ai-suggestions", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_photos")
        .select("id, matched_line_items, status")
        .eq("job_id", jobId)
        .eq("status", "analyzed");
      const out: AISuggestion[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (data ?? []) as any[]) {
        for (const it of (p.matched_line_items ?? []) as AISuggestion[]) {
          if (!it.suggested_code) continue;
          out.push({ ...it, photo_id: p.id });
        }
      }
      return out;
    },
  });

  const visible = suggestions.filter((s) => !dismissed.has(`${s.photo_id}::${s.suggested_code}`));
  if (visible.length === 0) return null;

  const approveAll = async () => {
    setWorking(true);
    try {
      const items = visible
        .filter((s) => s.suggested_code)
        .map((s) => ({ code: s.suggested_code!, qty: Number(s.suggested_qty ?? 1) }));
      await onApprove(items);
      setDismissed(new Set(visible.map((s) => `${s.photo_id}::${s.suggested_code}`)));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "rgba(168,85,247,0.4)", backgroundColor: "rgba(168,85,247,0.05)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold">AI Suggestions from Photos</h3>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
            {visible.length}
          </span>
        </div>
        <button
          onClick={approveAll}
          disabled={working}
          className="btn-brand h-8 rounded-md px-3 text-xs font-semibold disabled:opacity-40"
        >
          <Check className="mr-1 inline h-3 w-3" /> Approve all & insert
        </button>
      </div>
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {visible.map((s, i) => (
          <div
            key={`${s.photo_id}-${s.suggested_code}-${i}`}
            className="flex items-center justify-between gap-2 rounded border bg-[var(--bg-card)] p-2 text-xs"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-foreground">
                <span className="font-mono-num text-purple-400">{s.suggested_code}</span> · {s.description}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Qty: {s.suggested_qty ?? 1} {s.unit ?? "EA"} · confidence: {s.confidence}
              </p>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(`${s.photo_id}::${s.suggested_code}`))}
              className="text-muted-foreground hover:text-red-400"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
