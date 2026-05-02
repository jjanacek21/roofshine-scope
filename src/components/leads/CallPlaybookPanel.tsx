import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, X, BookOpen, Phone } from "lucide-react";
import { useCallPlaybook } from "@/hooks/useCallPlaybook";
import { PLAYBOOK_SECTIONS, type PlaybookSection } from "@/lib/playbook";
import { PlaybookSectionView } from "@/components/leads/PlaybookContent";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "gcn.playbook.panel.pos";
const SECTIONS_KEY = "gcn.playbook.panel.sections";

interface Pos {
  x: number;
  y: number;
}

export function CallPlaybookPanel() {
  const { open, lead, close } = useCallPlaybook();
  const [pos, setPos] = useState<Pos>(() => readStoredPos());
  const [enabledIds, setEnabledIds] = useState<string[]>(() => readEnabledSections());
  const [activeId, setActiveId] = useState<string>(() => readEnabledSections()[0] ?? "quickRef");
  const [showPicker, setShowPicker] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Persist position
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      /* noop */
    }
  }, [pos]);
  useEffect(() => {
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(enabledIds));
    } catch {
      /* noop */
    }
  }, [enabledIds]);

  const ctx = useMemo<Record<string, string | number | null | undefined>>(() => {
    if (!lead) return {};
    const ownerName = lead.owner ?? "";
    const first = ownerName.split(/\s+/)[0] || "there";
    const six = new Date();
    six.setMonth(six.getMonth() + 6);
    return {
      first_name: first,
      address: lead.address,
      city: lead.city ?? "",
      sqft: lead.sqft ?? "",
      roof_type: lead.roof_type ?? "",
      year_built: lead.year_built ?? "",
      rep_name: "your name",
      rep_phone: "your number",
      email: "their email",
      six_months_out: six.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  }, [lead]);

  const enabledSections: PlaybookSection[] = useMemo(
    () => PLAYBOOK_SECTIONS.filter((s) => enabledIds.includes(s.id)),
    [enabledIds],
  );
  const active = enabledSections.find((s) => s.id === activeId) ?? enabledSections[0];

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
      x: clamp(dragRef.current.baseX + dx, 8, window.innerWidth - 460),
      y: clamp(dragRef.current.baseY + dy, 8, window.innerHeight - 200),
    });
  }
  function endDrag() {
    dragRef.current = null;
    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
  }

  if (!open) return null;

  return (
    <div
      className="fixed z-[80] flex w-[440px] max-w-[95vw] flex-col rounded-2xl border shadow-2xl"
      style={{
        left: pos.x,
        top: pos.y,
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border)",
        maxHeight: "min(80vh, 720px)",
      }}
    >
      <header
        className="flex items-center gap-2 rounded-t-2xl border-b px-3 py-2"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-hover)", cursor: "grab" }}
        onMouseDown={startDrag}
      >
        <GripVertical className="h-4 w-4 text-[var(--text-dim)]" />
        <Phone className="h-4 w-4 text-[var(--primary)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            On-call playbook {lead ? `· ${lead.address}` : ""}
          </p>
          {lead?.owner && (
            <p className="truncate text-[11px] text-[var(--text-dim)]">
              Owner: {lead.owner}
              {lead.sqft ? ` · ${lead.sqft.toLocaleString()} sqft` : ""}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="rounded-md p-1.5 text-[var(--text-dim)] hover:bg-[var(--bg-card)] hover:text-foreground"
          title="Choose sections"
        >
          <BookOpen className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={close}
          className="rounded-md p-1.5 text-[var(--text-dim)] hover:bg-[var(--bg-card)] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {showPicker && (
        <div
          className="border-b p-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
            Sections
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PLAYBOOK_SECTIONS.map((s) => {
              const checked = enabledIds.includes(s.id);
              return (
                <label
                  key={s.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                    checked ? "border-[var(--primary)]" : "",
                  )}
                  style={{ borderColor: checked ? undefined : "var(--border)" }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setEnabledIds((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                      );
                    }}
                  />
                  <span className="truncate text-foreground">{s.title}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
        {enabledSections.map((s) => {
          const isActive = active?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveId(s.id)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-[var(--bg-hover)] text-foreground"
                  : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
              )}
            >
              {s.title}
            </button>
          );
        })}
      </div>

      <div className="overflow-y-auto p-4">
        {active ? (
          <PlaybookSectionView section={active} ctx={ctx} />
        ) : (
          <p className="text-center text-xs text-[var(--text-dim)]">
            Pick at least one section above to see scripts.
          </p>
        )}
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function readStoredPos(): Pos {
  if (typeof window === "undefined") return { x: 24, y: 120 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Pos;
      if (typeof v.x === "number" && typeof v.y === "number") return v;
    }
  } catch {
    /* noop */
  }
  return { x: Math.max(24, window.innerWidth - 480), y: 120 };
}

function readEnabledSections(): string[] {
  if (typeof window === "undefined") return ["quickRef", "rebuttals", "masterScript"];
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v) && v.length > 0) return v as string[];
    }
  } catch {
    /* noop */
  }
  return ["quickRef", "rebuttals", "masterScript"];
}
