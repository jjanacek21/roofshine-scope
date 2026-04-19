import { Plus, Copy } from "lucide-react";

export type EstimateRow = {
  id: string;
  name: string;
  tier: string;
  status: string;
  total: number;
};

const TIERS = [
  { value: "good", label: "Good" },
  { value: "better", label: "Better" },
  { value: "best", label: "Best" },
  { value: "supplement", label: "Supplement" },
] as const;

export function TierTabs({
  estimates,
  activeId,
  onSelect,
  onCreateTier,
  onDuplicate,
}: {
  estimates: EstimateRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateTier: (tier: string) => void;
  onDuplicate: () => void;
}) {
  const existingTiers = new Set(estimates.map((e) => e.tier));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {estimates.map((est) => {
        const active = est.id === activeId;
        return (
          <button
            key={est.id}
            onClick={() => onSelect(est.id)}
            className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all"
            style={
              active
                ? {
                    background: "linear-gradient(180deg, var(--chrome-1), var(--chrome-2))",
                    color: "#0a0a0b",
                    border: "1px solid var(--chrome-3)",
                  }
                : {
                    background: "var(--bg-card)",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border)",
                  }
            }
          >
            <span className="capitalize">{est.tier === "original" ? est.name : est.tier}</span>
            <span
              className="font-mono-num text-[10px] font-bold opacity-70"
              style={{ letterSpacing: ".3px" }}
            >
              ${Math.round(Number(est.total ?? 0)).toLocaleString()}
            </span>
          </button>
        );
      })}

      {/* Add tier menu */}
      <div className="relative ml-1">
        <details className="group">
          <summary
            className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add tier
          </summary>
          <div
            className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border shadow-lg"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
          >
            {TIERS.filter((t) => !existingTiers.has(t.value)).map((t) => (
              <button
                key={t.value}
                onClick={() => onCreateTier(t.value)}
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[var(--bg-hover)]"
              >
                {t.label}
              </button>
            ))}
            {TIERS.every((t) => existingTiers.has(t.value)) && (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">All tiers added</div>
            )}
          </div>
        </details>
      </div>

      {activeId && (
        <button
          onClick={onDuplicate}
          className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </button>
      )}
    </div>
  );
}
