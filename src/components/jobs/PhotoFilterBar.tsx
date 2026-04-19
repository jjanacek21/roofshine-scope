import { useState } from "react";
import { Filter } from "lucide-react";
import { TRADES } from "@/lib/trades";
import { PHOTO_TAGS, PHOTO_TAG_LABELS } from "@/lib/photo-tags";

export type PhotoFilters = {
  tag: string | "all";
  trade: string | "all";
  analyzed: "all" | "analyzed" | "unanalyzed";
};

export const DEFAULT_FILTERS: PhotoFilters = {
  tag: "all",
  trade: "all",
  analyzed: "all",
};

export function PhotoFilterBar({
  filters,
  onChange,
  count,
  onAnalyzeAll,
  analyzeAllPending,
  unanalyzedCount,
}: {
  filters: PhotoFilters;
  onChange: (f: PhotoFilters) => void;
  count: number;
  onAnalyzeAll: () => void;
  analyzeAllPending: boolean;
  unanalyzedCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
      <Filter className="h-4 w-4 text-muted-foreground" />

      <Select
        label="Tag"
        value={filters.tag}
        onChange={(v) => onChange({ ...filters, tag: v })}
        options={[
          { value: "all", label: "All tags" },
          ...PHOTO_TAGS.map((t) => ({ value: t, label: PHOTO_TAG_LABELS[t] })),
        ]}
      />
      <Select
        label="Trade"
        value={filters.trade}
        onChange={(v) => onChange({ ...filters, trade: v })}
        options={[
          { value: "all", label: "All trades" },
          ...TRADES.map((t) => ({ value: t.value, label: t.label })),
        ]}
      />
      <Select
        label="Status"
        value={filters.analyzed}
        onChange={(v) => onChange({ ...filters, analyzed: v as PhotoFilters["analyzed"] })}
        options={[
          { value: "all", label: "All" },
          { value: "analyzed", label: "Analyzed" },
          { value: "unanalyzed", label: "Unanalyzed" },
        ]}
      />

      <span className="ml-auto text-xs text-muted-foreground font-mono-num">
        {count} photo{count === 1 ? "" : "s"}
      </span>
      <button
        onClick={onAnalyzeAll}
        disabled={analyzeAllPending || unanalyzedCount === 0}
        className="btn-brand inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold disabled:opacity-40"
      >
        {analyzeAllPending ? "Analyzing…" : `Analyze All Unanalyzed (${unanalyzedCount})`}
      </button>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="h-8 rounded-md border bg-[var(--bg-elevated)] px-2 text-xs text-foreground"
        style={{ borderColor: "var(--border)" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {open ? null : null}
    </label>
  );
}
