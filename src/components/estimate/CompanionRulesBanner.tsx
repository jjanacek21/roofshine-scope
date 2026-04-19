import { AlertTriangle, X, Plus } from "lucide-react";

export type CompanionSuggestion = {
  id: string;
  triggerCategory: string;
  ruleType: string;
  codes: string[];
  notes: string | null;
};

export function CompanionRulesBanner({
  suggestion,
  onAddCode,
  onAddAll,
  onDismiss,
}: {
  suggestion: CompanionSuggestion;
  onAddCode: (code: string) => void;
  onAddAll: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-4"
      style={{
        backgroundColor: "rgba(234,179,8,0.08)",
        borderColor: "rgba(234,179,8,0.35)",
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(234,179,8,0.2)" }}
      >
        <AlertTriangle className="h-4 w-4" style={{ color: "#eab308" }} />
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#eab308" }}
          >
            {suggestion.ruleType}
          </span>
          <p className="text-[13px] text-foreground">
            You added <span className="font-semibold">{suggestion.triggerCategory}</span>.
            Commonly needed with this:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {suggestion.codes.map((code) => (
            <button
              key={code}
              onClick={() => onAddCode(code)}
              className="font-mono-num inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-[var(--bg-hover)]"
              style={{ borderColor: "var(--border-bright)", color: "var(--text)" }}
            >
              <Plus className="h-3 w-3" />
              {code}
            </button>
          ))}
        </div>

        {suggestion.notes && (
          <p className="text-[12px] text-muted-foreground">{suggestion.notes}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onAddAll}
          className="btn-chrome flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
        >
          Add all
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-[var(--bg-hover)] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
