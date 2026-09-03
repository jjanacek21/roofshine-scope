import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronLeft, GraduationCap, Trophy, Video, Settings } from "lucide-react";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading, CbEmptyState } from "@/components/cb/primitives";
import { CbReveal, CbStagger } from "@/components/cb/motion";
import {
  useCbCourses,
  useMyProgress,
  useMyTrainingMinutes,
  useTrainingRules,
  useTrainingScope,
  useLiveSessions,
  useAssignments,
} from "@/hooks/useCbTraining";
import { formatMinutes } from "@/lib/cbTraining";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/cb/training/")({
  head: () => ({
    meta: [
      { title: "Company Training — Claim Buddy" },
      {
        name: "description",
        content:
          "Your company's own training classroom: courses, videos, quizzes, live coaching calls and a team scoreboard.",
      },
      { property: "og:title", content: "Company Training — Claim Buddy" },
      { property: "og:description", content: "Courses, quizzes and live coaching built by your own company." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainingHome,
});

function TrainingHome() {
  const navigate = useNavigate();
  const { workspaceId, workspaceName, isAdmin, role } = useTrainingScope();
  const courses = useCbCourses(isAdmin);
  const progress = useMyProgress();
  const minutes = useMyTrainingMinutes();
  const rules = useTrainingRules();
  const live = useLiveSessions();
  const assignments = useAssignments();

  /* Lesson counts per course, so a card can show "3 of 8 done". */
  const lessonCounts = useQuery({
    queryKey: ["cb-lesson-counts", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_lessons")
        .select("id, course_id")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const l of data ?? []) map.set(l.course_id as string, (map.get(l.course_id as string) ?? 0) + 1);
      return map;
    },
  });

  const doneByCourse = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of progress.data ?? []) {
      if (p.completed_at) map.set(p.course_id, (map.get(p.course_id) ?? 0) + 1);
    }
    return map;
  }, [progress.data]);

  const myRule = useMemo(
    () => (rules.data ?? []).find((r) => r.role === role) ?? (rules.data ?? []).find((r) => r.role === "all"),
    [rules.data, role],
  );

  const required = useMemo(() => {
    const ids = new Set<string>();
    for (const a of assignments.data ?? []) {
      if (a.audience === "all" || (a.audience === "role" && a.role === role)) ids.add(a.course_id);
    }
    return ids;
  }, [assignments.data, role]);

  const nextLive = useMemo(
    () => (live.data ?? []).find((s) => new Date(s.starts_at).getTime() > Date.now() - 30 * 60000) ?? null,
    [live.data],
  );

  const list = courses.data ?? [];

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[840px] px-5 pb-28 pt-8">
          <CbReveal>
            <button
              type="button"
              onClick={() => navigate({ to: "/cb" })}
              className="mb-4 inline-flex items-center gap-1 text-[13px]"
              style={{ color: "var(--cb-text-muted)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              Dashboard
            </button>
            <h1 className="cb-display" style={{ fontSize: 26, lineHeight: 1.15 }}>
              Company Training
            </h1>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {workspaceName}'s own classroom — separate from the Survival Guide.
            </p>
          </CbReveal>

          <CbReveal delay={60}>
            <div className="mt-5 flex flex-wrap gap-2">
              <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb/training/scoreboard" })}>
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" /> Scoreboard
                </span>
              </CbButton>
              <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb/training/live" })}>
                <span className="inline-flex items-center gap-1.5">
                  <Video className="h-4 w-4" /> Live coaching
                </span>
              </CbButton>
              {isAdmin ? (
                <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb/admin/training" })}>
                  <span className="inline-flex items-center gap-1.5">
                    <Settings className="h-4 w-4" /> Manage
                  </span>
                </CbButton>
              ) : null}
            </div>
          </CbReveal>

          {myRule ? (
            <CbReveal delay={90}>
              <CbCard elevation="raised" className="mt-5" style={{ padding: 18 }}>
                <p className="cb-microlabel">This {myRule.period}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,.08)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (((myRule.period === "week" ? minutes.data?.week : minutes.data?.month) ?? 0) /
                              Math.max(1, myRule.required_minutes)) *
                              100,
                          ),
                        )}%`,
                        background: "var(--cb-accent)",
                      }}
                    />
                  </div>
                  <span className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                    {formatMinutes((myRule.period === "week" ? minutes.data?.week : minutes.data?.month) ?? 0)} of{" "}
                    {formatMinutes(myRule.required_minutes)}
                  </span>
                </div>
              </CbCard>
            </CbReveal>
          ) : null}

          {nextLive ? (
            <CbReveal delay={110}>
              <CbCard elevation="card" className="mt-4" style={{ padding: 18 }}>
                <p className="cb-microlabel">Next live session</p>
                <p className="mt-1 text-[15px] font-semibold">{nextLive.title}</p>
                <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                  {new Date(nextLive.starts_at).toLocaleString()}
                </p>
                <div className="mt-3">
                  <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb/training/live" })}>
                    Details
                  </CbButton>
                </div>
              </CbCard>
            </CbReveal>
          ) : null}

          <div className="mt-6">
            {courses.isLoading ? (
              <CbLoading label="Loading courses…" />
            ) : list.length === 0 ? (
              <CbEmptyState
                headline="No courses yet"

                body={
                  isAdmin
                    ? "Build your first course — write it yourself or let AI draft it from a topic."
                    : "Your company hasn't published any training yet."
                }
                action={
                  isAdmin ? (
                    <CbButton size="md" onClick={() => navigate({ to: "/cb/admin/training" })}>
                      Create a course
                    </CbButton>
                  ) : undefined
                }
              />
            ) : (
              <CbStagger className="space-y-3">
                {list.map((c) => {
                  const total = lessonCounts.data?.get(c.id) ?? 0;
                  const done = doneByCourse.get(c.id) ?? 0;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <CbCard
                      key={c.id}
                      elevation="card"
                      style={{ padding: 18, cursor: "pointer" }}
                      onClick={() => navigate({ to: "/cb/training/course/$id", params: { id: c.id } })}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
                          style={{ background: "color-mix(in oklab, var(--cb-accent) 14%, transparent)" }}
                        >
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[16px] font-semibold">{c.title}</p>
                            {c.status === "draft" ? <CbBadge tone="warning">Draft</CbBadge> : null}
                            {required.has(c.id) ? <CbBadge tone="accent">Required</CbBadge> : null}
                            {pct === 100 ? <CbBadge tone="success">Done</CbBadge> : null}
                          </div>
                          {c.description ? (
                            <p className="mt-1 line-clamp-2 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                              {c.description}
                            </p>
                          ) : null}
                          <div className="mt-3 flex items-center gap-3">
                            <div
                              className="h-1.5 flex-1 overflow-hidden rounded-full"
                              style={{ background: "rgba(0,0,0,.08)" }}
                            >
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--cb-accent)" }} />
                            </div>
                            <span className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                              {done}/{total} lessons
                            </span>
                          </div>
                        </div>
                      </div>
                    </CbCard>
                  );
                })}
              </CbStagger>
            )}
          </div>
        </div>
      </div>
    </CbSurface>
  );
}
