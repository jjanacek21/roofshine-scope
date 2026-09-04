import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Medal } from "lucide-react";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbBadge, CbLoading, CbEmptyState } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import { useScoreboard } from "@/hooks/useCbTraining";
import { formatMinutes } from "@/lib/cbTraining";

export const Route = createFileRoute("/_app/training/scoreboard")({
  head: () => ({
    meta: [
      { title: "Training scoreboard — Global Contractor" },
      { name: "description", content: "See how your team ranks on training points and hours this week and month." },
      { property: "og:title", content: "Training scoreboard — Global Contractor" },
      { property: "og:description", content: "Team ranking on training points and hours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScoreboardPage,
});

const PERIODS = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
] as const;

function ScoreboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const { rows, loading } = useScoreboard(period);

  return (
    <CbSurface skin="app">
      <div>
        <div className="mx-auto w-full max-w-[840px]">
          <CbReveal>
            <button
              type="button"
              onClick={() => navigate({ to: "/training" })}
              className="mb-4 inline-flex items-center gap-1 text-[13px]"
              style={{ color: "var(--cb-text-muted)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              Training
            </button>
            <h1 className="cb-display" style={{ fontSize: 26 }}>
              Scoreboard
            </h1>
          </CbReveal>

          <div className="mt-4 flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="cb-chip"
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                style={
                  period === p.key
                    ? { background: "var(--cb-accent)", color: "#fff", borderColor: "transparent" }
                    : undefined
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            {loading ? (
              <CbLoading label="Tallying points…" />
            ) : rows.length === 0 ? (
              <CbEmptyState headline="No training activity yet" body="Points show up as your team finishes lessons." />
            ) : (
              rows.map((r, i) => (
                <CbCard key={r.user_id} elevation="card" style={{ padding: 14 }}>
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold"
                      style={{
                        background: i < 3 ? "color-mix(in oklab, var(--cb-accent) 18%, transparent)" : "rgba(0,0,0,.05)",
                      }}
                    >
                      {i < 3 ? <Medal className="h-4 w-4" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold">{r.name}</p>
                      <p className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                        {formatMinutes(r.minutes)} trained · {r.role}
                      </p>
                    </div>
                    <CbBadge tone={i === 0 ? "success" : "neutral"}>{r.points} pts</CbBadge>
                  </div>
                </CbCard>
              ))
            )}
          </div>
        </div>
      </div>
    </CbSurface>
  );
}
