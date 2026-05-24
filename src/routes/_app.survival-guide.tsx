import { createFileRoute } from "@tanstack/react-router";
import { BookOpenText } from "lucide-react";

export const Route = createFileRoute("/_app/survival-guide")({
  head: () => ({
    meta: [
      { title: "Survival Guide — globalcontractor.app" },
      {
        name: "description",
        content:
          "Blue Collar Sales Survival Guide — door-to-door, cold-call, insurance, rebuttals, closes, and trainer cheat sheets for field reps.",
      },
    ],
  }),
  component: SurvivalGuidePage,
});

function SurvivalGuidePage() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3 lg:h-[calc(100vh-5rem)]">
      <header className="flex items-center gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{ backgroundColor: "color-mix(in oklab, var(--primary) 14%, transparent)" }}
        >
          <BookOpenText className="h-5 w-5 text-[var(--primary)]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Survival Guide</h1>
          <p className="truncate text-sm text-[var(--text-dim)]">
            Blue collar sales playbook — scripts, rebuttals, insurance, and trainer cheat sheets.
          </p>
        </div>
      </header>

      <div
        className="flex-1 overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "#0a0a0f" }}
      >
        <iframe
          src="/survival-guide/index.html"
          title="Blue Collar Sales Survival Guide"
          className="block h-full w-full"
          style={{ border: 0 }}
        />
      </div>
    </div>
  );
}
