import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GripVertical, X, Phone, BookOpen } from "lucide-react";
import { useCallPlaybook } from "@/hooks/useCallPlaybook";
import { useMyPlaybook } from "@/hooks/useMyPlaybook";
import { PLAYBOOK } from "@/lib/playbook";
import { PlaybookCategoryView } from "@/components/leads/PlaybookContent";

const STORAGE_KEY = "gcn.playbook.panel.pos";

interface Pos { x: number; y: number }

export function CallPlaybookPanel() {
  const { open, lead, close } = useCallPlaybook();
  const { ids } = useMyPlaybook();
  const [pos, setPos] = useState<Pos>(() => readStoredPos());
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* noop */ }
  }, [pos]);

  function startDrag(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", endDrag);
  }
  function onDrag(e: MouseEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: clamp(dragRef.current.baseX + dx, 8, window.innerWidth - 400),
      y: clamp(dragRef.current.baseY + dy, 8, window.innerHeight - 200),
    });
  }
  function endDrag() {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
  }

  if (!open) return null;

  const enabledCategories = PLAYBOOK.filter((c) => ids.includes(c.id));

  return (
    <div
      className="fixed z-50 flex flex-col rounded-2xl border shadow-2xl"
      style={{
        left: pos.x,
        top: pos.y,
        width: 384,
        maxWidth: "95vw",
        maxHeight: "70vh",
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border)",
      }}
    >
      <header
        className="flex items-center gap-2 rounded-t-2xl border-b px-3 py-2 select-none"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)", cursor: "move" }}
        onMouseDown={startDrag}
      >
        <GripVertical className="h-4 w-4 text-[var(--text-dim)]" />
        <Phone className="h-4 w-4 text-[var(--success)]" />
        <p className="flex-1 truncate text-xs font-semibold text-foreground">📞 Call Playbook</p>
        <button
          type="button"
          onClick={close}
          className="rounded-md p-1 text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {lead && (
          <div
            className="mb-3 rounded-lg border p-2.5 text-[11px]"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
          >
            {lead.owner && <div className="font-semibold text-foreground">{lead.owner}</div>}
            <div className="text-[var(--text-dim)]">
              {lead.address}{lead.city ? `, ${lead.city}` : ""}
            </div>
            {(lead.sqft || lead.roof_type || lead.year_built) && (
              <div className="mt-0.5 text-[var(--text-dim)]">
                {[
                  lead.sqft ? `${lead.sqft.toLocaleString()} sqft` : null,
                  lead.roof_type ?? null,
                  lead.year_built ? `Built ${lead.year_built}` : null,
                ].filter(Boolean).join(" • ")}
              </div>
            )}
          </div>
        )}

        {enabledCategories.length === 0 ? (
          <div className="rounded-lg border p-4 text-center text-xs text-[var(--text-dim)]" style={{ borderColor: "var(--border)" }}>
            <BookOpen className="mx-auto mb-2 h-5 w-5" />
            <p className="mb-2">No sections selected</p>
            <Link
              to="/leads/training"
              onClick={close}
              className="inline-block rounded-md border px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-[var(--bg-hover)]"
              style={{ borderColor: "var(--border)" }}
            >
              Open Training Center
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {enabledCategories.map((cat) => (
              <PlaybookCategoryView key={cat.id} category={cat} collapsedByDefault dense />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function readStoredPos(): Pos {
  if (typeof window === "undefined") return { x: 24, y: 80 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Pos;
      if (typeof v.x === "number" && typeof v.y === "number") return v;
    }
  } catch { /* noop */ }
  return { x: Math.max(24, window.innerWidth - 408), y: 80 };
}
