import { EDGE_LABELS, EDGE_COLORS, type EdgeType } from "@/lib/roof-math";

const TYPES = Object.keys(EDGE_LABELS) as EdgeType[];

export function EdgeLabelEditor({
  edges,
  lengths,
  onChange,
}: {
  edges: (EdgeType | null)[];
  lengths: number[];
  onChange: (next: (EdgeType | null)[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {edges.map((edge, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-xs" style={{ borderColor: "var(--border)" }}>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: edge ? EDGE_COLORS[edge] : "var(--border)" }}
          />
          <span className="w-12 font-mono-num text-muted-foreground">#{i + 1}</span>
          <select
            value={edge ?? ""}
            onChange={(e) => {
              const v = e.target.value as EdgeType | "";
              const next = [...edges];
              next[i] = v === "" ? null : v;
              onChange(next);
            }}
            className="h-7 flex-1 rounded border bg-[var(--bg-elevated)] px-2 text-xs text-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            <option value="">— unlabeled —</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{EDGE_LABELS[t]}</option>
            ))}
          </select>
          <span className="w-20 text-right font-mono-num text-muted-foreground">
            {lengths[i]?.toFixed(1) ?? "0"} ft
          </span>
        </div>
      ))}
    </div>
  );
}
