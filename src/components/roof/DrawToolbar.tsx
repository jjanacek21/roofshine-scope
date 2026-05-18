import { Pentagon, Slash, MapPin, MousePointer2, Undo2, Trash2, Tag, X } from "lucide-react";
import { EDGE_LABELS, EDGE_COLORS, type EdgeType, EDGE_TYPES } from "@/lib/roof-math";

type Tool = "polygon" | "line" | "point" | "select" | "label";

export function DrawToolbar({
  active,
  onChoose,
  onUndo,
  onClearAll,
  activeEdge,
  onChooseEdge,
}: {
  active: Tool | null;
  onChoose: (t: Tool) => void;
  onUndo: () => void;
  onClearAll: () => void;
  activeEdge?: EdgeType | "clear" | null;
  onChooseEdge?: (e: EdgeType | "clear" | null) => void;
}) {
  const tools: Array<{ key: Tool; label: string; Icon: typeof Pentagon }> = [
    { key: "polygon", label: "Polygon", Icon: Pentagon },
    { key: "line", label: "Line", Icon: Slash },
    { key: "point", label: "Point", Icon: MapPin },
    { key: "select", label: "Select", Icon: MousePointer2 },
    { key: "label", label: "Label", Icon: Tag },
  ];

  const hint =
    active === "select"
      ? "Click a roof to edit · drag corner pins to move them"
      : active === "polygon"
        ? "Click to add corners · double-click or press Enter to finish · Esc to cancel"
        : active === "line"
          ? "Click to add points · clicks near an existing dot snap to it · double-click or Enter to finish"
          : active === "point"
            ? "Click to drop a penetration"
            : active === "label"
              ? activeEdge && activeEdge !== "clear"
                ? `Painting ${EDGE_LABELS[activeEdge]} — click any segment to label it. Switch type anytime.`
                : activeEdge === "clear"
                  ? "Eraser active — click any labeled segment to clear it."
                  : "Pick a type below, then click segments to paint that label."
              : null;

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
            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs transition ${
              active === t.key
                ? "bg-[var(--brand)] text-white"
                : "text-foreground/80 hover:bg-white/10"
            }`}
          >
            <t.Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/15" />
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

      {active === "label" && onChooseEdge ? (
        <div
          className="flex max-w-[520px] flex-wrap items-center gap-1 rounded-xl border p-1.5 shadow-lg backdrop-blur"
          style={{
            backgroundColor: "rgba(10,10,11,0.85)",
            borderColor: "var(--border-bright, var(--border))",
          }}
        >
          {EDGE_TYPES.map((t) => {
            const isActive = activeEdge === t;
            return (
              <button
                key={t}
                onClick={() => onChooseEdge(isActive ? null : t)}
                title={EDGE_LABELS[t]}
                className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${
                  isActive
                    ? "border-white/40 bg-white/10 text-foreground"
                    : "border-transparent text-foreground/80 hover:bg-white/10"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: EDGE_COLORS[t] }}
                />
                {EDGE_LABELS[t]}
              </button>
            );
          })}
          <div className="mx-1 h-5 w-px bg-white/15" />
          <button
            onClick={() => onChooseEdge(activeEdge === "clear" ? null : "clear")}
            title="Eraser"
            className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] transition ${
              activeEdge === "clear"
                ? "border-red-400/60 bg-red-500/20 text-red-200"
                : "border-transparent text-foreground/80 hover:bg-red-500/20 hover:text-red-300"
            }`}
          >
            <X className="h-3 w-3" />
            Eraser
          </button>
        </div>
      ) : null}

      {hint ? (
        <div
          className="max-w-[520px] rounded-md border px-2.5 py-1 text-[11px] leading-snug text-foreground/90 shadow"
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
