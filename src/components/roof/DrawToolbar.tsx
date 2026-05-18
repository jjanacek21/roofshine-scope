import { Pentagon, Slash, MapPin, MousePointer2, Undo2, Trash2, Tag } from "lucide-react";

type Tool = "polygon" | "line" | "point" | "select" | "label";

export function DrawToolbar({
  active,
  onChoose,
  onUndo,
  onClearAll,
}: {
  active: Tool | null;
  onChoose: (t: Tool) => void;
  onUndo: () => void;
  onClearAll: () => void;
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
              ? "Click any edge, line, or pin to label it — labeled lines change color"
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
