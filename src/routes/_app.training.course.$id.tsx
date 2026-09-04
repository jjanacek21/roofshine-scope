import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronLeft, CheckCircle2, Circle, FileText, HelpCircle, PlayCircle, Radio } from "lucide-react";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading, CbEmptyState } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import { CbTutor } from "@/components/claim-buddy/training/CbTutor";
import { useCbCourse, useMyProgress } from "@/hooks/useCbTraining";
import { formatDuration, type CbLessonKind } from "@/lib/cbTraining";

export const Route = createFileRoute("/_app/training/course/$id")({
  head: () => ({
    meta: [
      { title: "Course — Company Training" },
      { name: "description", content: "Work through the lessons, checkpoints and quizzes in this company course." },
      { property: "og:title", content: "Course — Company Training" },
      { property: "og:description", content: "Lessons, checkpoints and quizzes in your company's training." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursePage,
});

const KIND_ICON: Record<CbLessonKind, typeof PlayCircle> = {
  video: PlayCircle,
  article: FileText,
  document: FileText,
  quiz: HelpCircle,
  live: Radio,
};

function CoursePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useCbCourse(id);
  const progress = useMyProgress();

  const doneIds = useMemo(
    () => new Set((progress.data ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id)),
    [progress.data],
  );

  const lessons = data?.lessons ?? [];
  const nextLesson = lessons.find((l) => !doneIds.has(l.id)) ?? lessons[0] ?? null;

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
          </CbReveal>

          {isLoading ? (
            <CbLoading label="Loading course…" />
          ) : !data?.course ? (
            <CbEmptyState headline="Course not found" body="It may have been archived." />
          ) : (
            <>
              <CbReveal>
                <h1 className="cb-display" style={{ fontSize: 24, lineHeight: 1.15 }}>
                  {data.course.title}
                </h1>
                {data.course.description ? (
                  <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                    {data.course.description}
                  </p>
                ) : null}
              </CbReveal>

              {nextLesson ? (
                <CbReveal delay={60}>
                  <div className="mt-4">
                    <CbButton
                      block
                      onClick={() => navigate({ to: "/training/lesson/$id", params: { id: nextLesson.id } })}
                    >
                      {doneIds.has(nextLesson.id) ? "Review the course" : "Continue where you left off"}
                    </CbButton>
                  </div>
                </CbReveal>
              ) : null}

              <div className="mt-6 space-y-5">
                {(data.modules ?? []).map((mod) => {
                  const modLessons = lessons.filter((l) => l.module_id === mod.id);
                  return (
                    <div key={mod.id}>
                      <p className="cb-microlabel">{mod.title}</p>
                      {mod.summary ? (
                        <p className="mb-2 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                          {mod.summary}
                        </p>
                      ) : null}
                      <div className="mt-2 space-y-2">
                        {modLessons.map((l) => {
                          const Icon = KIND_ICON[l.kind] ?? FileText;
                          const done = doneIds.has(l.id);
                          return (
                            <CbCard
                              key={l.id}
                              elevation="card"
                              style={{ padding: 14, cursor: "pointer" }}
                              onClick={() => navigate({ to: "/training/lesson/$id", params: { id: l.id } })}
                            >
                              <div className="flex items-center gap-3">
                                {done ? (
                                  <CheckCircle2 className="h-5 w-5" style={{ color: "var(--cb-accent)" }} />
                                ) : (
                                  <Circle className="h-5 w-5" style={{ color: "var(--cb-text-muted)" }} />
                                )}
                                <Icon className="h-4 w-4" style={{ color: "var(--cb-text-muted)" }} />
                                <span className="min-w-0 flex-1 truncate text-[14.5px]">{l.title}</span>
                                {l.duration_seconds ? (
                                  <span className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
                                    {formatDuration(l.duration_seconds)}
                                  </span>
                                ) : null}
                                {l.kind === "quiz" ? <CbBadge tone="accent">Quiz</CbBadge> : null}
                              </div>
                            </CbCard>
                          );
                        })}
                        {modLessons.length === 0 ? (
                          <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                            No lessons in this module yet.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <CbTutor courseId={id} courseTitle={data.course.title} />
            </>
          )}
        </div>
      </div>
    </CbSurface>
  );
}
