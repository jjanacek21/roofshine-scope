import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { GraduationCap, Check, Plus } from "lucide-react";
import { PLAYBOOK, PLAYBOOK_COLOR_HEX } from "@/lib/playbook";
import { PlaybookCategoryView } from "@/components/leads/PlaybookContent";
import { useMyPlaybook } from "@/hooks/useMyPlaybook";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/leads/training")({
  component: TrainingCenter,
});

function TrainingCenter() {
  const [activeId, setActiveId] = useState(PLAYBOOK[0].id);
  const { ids: myIds, toggle } = useMyPlaybook();

  const active = useMemo(() => PLAYBOOK.find((c) => c.id === activeId) ?? PLAYBOOK[0], [activeId]);
  const inMine = myIds.includes(active.id);
  const accent = PLAYBOOK_COLOR_HEX[active.color];

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
        >
          <GraduationCap className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Training Center</h2>
          <p className="text-sm text-[var(--text-dim)]">
            Roof Kings cold-call playbook. Add sections to your playbook to see them in the on-call panel.
          </p>
        </div>
      </header>

      <div
        className="grid gap-0 rounded-xl border"
        style={{ borderColor: "var(--border)", gridTemplateColumns: "224px 1fr" }}
      >
        {/* LEFT: category sidebar (sticky on desktop) */}
        <nav
          className="self-start border-r p-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-elevated)" }}
        >
          {PLAYBOOK.map((cat) => {
            const isActive = active.id === cat.id;
            const isMine = myIds.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveId(cat.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "bg-[var(--bg-hover)] text-foreground font-medium"
                    : "text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-foreground",
                )}
              >
                <span className="text-base leading-none">{cat.emoji}</span>
                <span className="flex-1 truncate">{cat.title}</span>
                {isMine && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PLAYBOOK_COLOR_HEX.green }}
                    title="In My Playbook"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* RIGHT: scrollable content */}
        <div className="p-5" style={{ backgroundColor: "var(--bg-card)" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none">{active.emoji}</span>
              <h3 className="text-lg font-semibold" style={{ color: accent }}>{active.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => toggle(active.id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors",
              )}
              style={{
                borderColor: inMine ? PLAYBOOK_COLOR_HEX.green : "var(--border)",
                backgroundColor: inMine ? "color-mix(in oklab, " + PLAYBOOK_COLOR_HEX.green + " 18%, transparent)" : "transparent",
                color: inMine ? PLAYBOOK_COLOR_HEX.green : "var(--text-dim)",
              }}
            >
              {inMine ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {inMine ? "In My Playbook" : "Add to Playbook"}
            </button>
          </div>

          <PlaybookCategoryView category={active} />

          <p className="mt-6 text-center text-[11px] text-[var(--text-dim)]">
            <Link to="/leads/list" className="underline-offset-2 hover:underline">
              Sections you add appear in the floating Call Playbook during a call.
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
