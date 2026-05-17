import { Pentagon, Slash, MapPin, MousePointer2, Undo2, Trash2, Magnet, Tag, X } from "lucide-react";
import { EDGE_LABELS, EDGE_COLORS, type EdgeType } from "@/lib/roof-math";

type Tool = "polygon" | "line" | "point" | "select";

export function DrawToolbar({
  active,
  onChoose,
  onUndo,
  onClearAll,
  snapEnabled,
  onToggleSnap,
  labelMode,
  currentLabel,
  onToggleLabelMode,
  onSelectLabel,
}: {
  active: Tool | null;
  onChoose: (t: Tool) => void;
  onUndo: () => void;
  onClearAll: () => void;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
  labelMode?: boolean;
  currentLabel?: EdgeType | null;
  onToggleLabelMode?: () => void;
  onSelectLabel?: (e: EdgeType | null) => void;
}) {
  const tools: Array<{ key: Tool; label: string; Icon: typeof Pentagon }> = [
    { key: "polygon", label: "Polygon", Icon: Pentagon },
    { key: "line", label: "Edge / Line", Icon: Slash },
    { key: "point", label: "Point", Icon: MapPin },
    { key: "select", label: "Select", Icon: MousePointer2 },
  ];

  const hint = labelMode
    ? currentLabel
      ? `Click any line to label it as ${EDGE_LABELS[currentLabel]} · Esc / click Label edges again to exit`
      : "Pick a label below, then click each line that matches · Esc to exit"
    : active === "select"
      ? "Click a roof to edit · drag pins to move corners"
      : active === "polygon"
        ? `Click to add corners · double-click or Enter to finish · Esc to cancel${snapEnabled ? " · Snap ON" : ""}`
        : active === "line"
          ? `Click to add corners · endpoints snap to existing pins · double-click or Enter to finish${snapEnabled ? " · Snap ON" : ""}`
          : active === "point"
            ? "Click to drop a penetration"
            : null;

  const labels = Object.keys(EDGE_LABELS) as EdgeType[];

  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
      <div
        className="flex items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur"
        style={{
          backgroundColor: "rgba(10,10,11,0.85)",
          borderColor: "var(--border-bright, var(--border))",
        }}
      >
        {tools.map((t) => (
          <button
            key={t.key}
            onClick={() => onChoose(t.key)}
            title={t.label}
            aria-label={t.label}
            disabled={labelMode}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs transition disabled:opacity-40 ${
              active === t.key && !labelMode
                ? "bg-[var(--brand)] text-white"
                : "text-foreground/80 hover:bg-white/10"
            }`}
          >
            <t.Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/15" />
        {onToggleLabelMode ? (
          <button
            onClick={onToggleLabelMode}
            title="Label edges (click a label, then click each line)"
            aria-label="Label edges"
            aria-pressed={!!labelMode}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition ${
              labelMode
                ? "bg-[var(--brand)] text-white"
                : "text-foreground/80 hover:bg-white/10"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            Label edges
          </button>
        ) : null}
        <div className="mx-1 h-5 w-px bg-white/15" />
        {onToggleSnap ? (
          <button
            onClick={onToggleSnap}
            title="Snap to 0/45/90° (hold Shift to toggle while drawing)"
            aria-label="Toggle angle snap"
            aria-pressed={!!snapEnabled}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
              snapEnabled
                ? "bg-[var(--brand)] text-white"
                : "text-foreground/80 hover:bg-white/10"
            }`}
          >
            <Magnet className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          onClick={onUndo}
          title="Undo last"
          aria-label="Undo last"
          className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 hover:bg-white/10"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClearAll}
          title="Clear all"
          aria-label="Clear all"
          className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/80 hover:bg-red-500/20 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {labelMode && (
        <div
          className="flex max-w-[460px] flex-wrap items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur"
          style={{
            backgroundColor: "rgba(10,10,11,0.9)",
            borderColor: "var(--border-bright, var(--border))",
          }}
        >
          {labels.map((k) => {
            const active = currentLabel === k;
            return (
              <button
                key={k}
                onClick={() => onSelectLabel?.(active ? null : k)}
                className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition ${
                  active ? "text-white" : "text-foreground/85 hover:bg-white/10"
                }`}
                style={{
                  borderColor: active ? EDGE_COLORS[k] : "transparent",
                  backgroundColor: active ? EDGE_COLORS[k] : "transparent",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.95)" : EDGE_COLORS[k] }}
                />
                {EDGE_LABELS[k]}
              </button>
            );
          })}
          <div className="mx-1 h-4 w-px bg-white/15" />
          <button
            onClick={() => onSelectLabel?.(null)}
            title="Clear label tool (click a line to remove its label)"
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] transition ${
              currentLabel === null
                ? "bg-white/15 text-foreground"
                : "text-foreground/70 hover:bg-white/10"
            }`}
          >
            <X className="h-3 w-3" />
            Erase
          </button>
        </div>
      )}

      {hint ? (
        <div
          className="max-w-[460px] rounded-md border px-2.5 py-1 text-[11px] leading-snug text-foreground/90 shadow"
          style={{
            backgroundColor: "rgba(10,10,11,0.85)",
            borderColor: "var(--border-bright, var(--border))",
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
