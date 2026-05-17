import { Pentagon, Slash, MapPin, MousePointer2, Undo2, Trash2, Magnet } from "lucide-react";

type Tool = "polygon" | "line" | "point" | "select";

export function DrawToolbar({
  active,
  onChoose,
  onUndo,
  onClearAll,
  snapEnabled,
  onToggleSnap,
}: {
  active: Tool | null;
  onChoose: (t: Tool) => void;
  onUndo: () => void;
  onClearAll: () => void;
  snapEnabled?: boolean;
  onToggleSnap?: () => void;
}) {
  const tools: Array<{ key: Tool; label: string; Icon: typeof Pentagon }> = [
    { key: "polygon", label: "Polygon", Icon: Pentagon },
    { key: "line", label: "Line", Icon: Slash },
    { key: "point", label: "Point", Icon: MapPin },
    { key: "select", label: "Select", Icon: MousePointer2 },
  ];

  const hint =
    active === "select"
      ? "Click a roof to edit · drag pins to move corners · drag midpoints to add a corner"
      : active === "polygon"
        ? `Click to add corners · double-click or Enter to finish · Esc to cancel${snapEnabled ? " · Snap ON (hold Shift to toggle)" : " · Hold Shift for straight lines"}`
        : active === "line"
          ? `Click to add points · double-click or Enter to finish${snapEnabled ? " · Snap ON" : ""}`
          : active === "point"
            ? "Click to drop a penetration"
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
      {hint ? (
        <div
          className="max-w-[420px] rounded-md border px-2.5 py-1 text-[11px] leading-snug text-foreground/90 shadow"
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
