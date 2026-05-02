import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { PLAYBOOK_SECTIONS } from "@/lib/playbook";
import { PlaybookSectionView } from "@/components/leads/PlaybookContent";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/leads/training")({
  component: TrainingCenter,
});

function TrainingCenter() {
  const [activeId, setActiveId] = useState(PLAYBOOK_SECTIONS[0].id);
  const [query, setQuery] = useState("");

  const visible = query.trim()
    ? PLAYBOOK_SECTIONS.filter((s) => {
        const q = query.toLowerCase();
        if (s.title.toLowerCase().includes(q) || s.short.toLowerCase().includes(q)) return true;
        return s.blocks.some((b) => JSON.stringify(b).toLowerCase().includes(q));
      })
    : PLAYBOOK_SECTIONS;

  const active = visible.find((s) => s.id === activeId) ?? visible[0];

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
            Roof Kings cold-call playbook — scripts, rebuttals, and master flow for SPF restoration.
          </p>
        </div>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search scripts, rebuttals, pricing…"
          className="pl-9"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <nav
          className="h-fit space-y-1 rounded-xl border p-2"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          {visible.map((s) => {
            const isActive = active?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left transition-colors",
                  isActive
                    ? "bg-[var(--bg-hover)]"
                    : "hover:bg-[var(--bg-hover)]",
                )}
              >
                <div className="text-sm font-medium text-foreground">{s.title}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-dim)]">{s.short}</div>
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-[var(--text-dim)]">No matches.</p>
          )}
        </nav>

        <div>
          {active ? (
            <PlaybookSectionView section={active} />
          ) : (
            <div
              className="rounded-xl border p-10 text-center text-sm text-[var(--text-dim)]"
              style={{ borderColor: "var(--border)" }}
            >
              No section selected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
