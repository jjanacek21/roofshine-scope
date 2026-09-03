import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbLoading, CbEmptyState } from "@/components/cb/primitives";
import { CbReveal } from "@/components/cb/motion";
import { CbLessonPlayer } from "@/components/claim-buddy/training/CbLessonPlayer";
import { CbQuizRunner } from "@/components/claim-buddy/training/CbQuizRunner";
import { CbTutor } from "@/components/claim-buddy/training/CbTutor";
import { awardPoints, logEvent, useCbCourse, useCbLesson, useMyProgress, useTrainingScope } from "@/hooks/useCbTraining";

export const Route = createFileRoute("/cb/training/lesson/$id")({
  head: () => ({
    meta: [
      { title: "Lesson — Company Training" },
      { name: "description", content: "Watch, read and answer the checkpoints in this training lesson." },
      { property: "og:title", content: "Lesson — Company Training" },
      { property: "og:description", content: "A lesson in your company's training program." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaceId } = useTrainingScope();
  const { data, isLoading } = useCbLesson(id);
  const lesson = data?.lesson ?? null;
  const course = useCbCourse(lesson?.course_id ?? null);
  const progress = useMyProgress();
  const [docUrl, setDocUrl] = useState<string | null>(null);

  const siblings = course.data?.lessons ?? [];
  const index = siblings.findIndex((l) => l.id === id);
  const next = index >= 0 ? siblings[index + 1] : undefined;

  const done = useMemo(
    () => (progress.data ?? []).some((p) => p.lesson_id === id && p.completed_at),
    [progress.data, id],
  );

  useEffect(() => {
    let cancelled = false;
    if (!lesson?.document_path) {
      setDocUrl(null);
      return;
    }
    void supabase.storage
      .from("cb-training")
      .createSignedUrl(lesson.document_path, 60 * 60)
      .then(({ data: signed }) => {
        if (!cancelled) setDocUrl(signed?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson?.document_path]);

  async function markRead() {
    if (!workspaceId || !user?.id || !lesson) return;
    await supabase.from("cb_progress").upsert(
      {
        workspace_id: workspaceId,
        lesson_id: lesson.id,
        course_id: lesson.course_id,
        user_id: user.id,
        percent: 100,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "lesson_id,user_id" },
    );
    await awardPoints(workspaceId, user.id, "lesson_complete", lesson.id);
    await logEvent({
      workspaceId,
      userId: user.id,
      kind: "lesson_complete",
      courseId: lesson.course_id,
      lessonId: lesson.id,
      seconds: 180,
    });
    void progress.refetch();
  }

  async function onCourseCheck() {
    if (!workspaceId || !user?.id || !lesson) return;
    const remaining = siblings.filter(
      (l) => !(progress.data ?? []).some((p) => p.lesson_id === l.id && p.completed_at) && l.id !== lesson.id,
    );
    if (remaining.length === 0) {
      await awardPoints(workspaceId, user.id, "course_complete", lesson.course_id);
      await logEvent({
        workspaceId,
        userId: user.id,
        kind: "course_complete",
        courseId: lesson.course_id,
      });
    }
    void progress.refetch();
  }

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[840px] px-5 pb-32 pt-8">
          <CbReveal>
            <button
              type="button"
              onClick={() =>
                lesson
                  ? navigate({ to: "/cb/training/course/$id", params: { id: lesson.course_id } })
                  : navigate({ to: "/cb/training" })
              }
              className="mb-4 inline-flex items-center gap-1 text-[13px]"
              style={{ color: "var(--cb-text-muted)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              Course
            </button>
          </CbReveal>

          {isLoading ? (
            <CbLoading label="Loading lesson…" />
          ) : !lesson ? (
            <CbEmptyState headline="Lesson not found" />
          ) : (
            <>
              <CbReveal>
                <h1 className="cb-display" style={{ fontSize: 22, lineHeight: 1.2 }}>
                  {lesson.title}
                </h1>
              </CbReveal>

              <div className="mt-4 space-y-4">
                {lesson.kind === "video" ? (
                  <CbLessonPlayer
                    lesson={lesson}
                    checkpoints={data?.checkpoints ?? []}
                    onComplete={onCourseCheck}
                    onBranchLesson={(lid) => navigate({ to: "/cb/training/lesson/$id", params: { id: lid } })}
                  />
                ) : null}

                {lesson.kind === "quiz" ? (
                  <CbQuizRunner
                    lessonId={lesson.id}
                    courseId={lesson.course_id}
                    onPassed={onCourseCheck}
                  />
                ) : null}

                {lesson.body ? (
                  <CbCard elevation="card" style={{ padding: 18 }}>
                    <div className="cb-prose whitespace-pre-wrap text-[14.5px] leading-[1.6]">{lesson.body}</div>
                  </CbCard>
                ) : null}

                {docUrl ? (
                  <CbCard elevation="card" style={{ padding: 18 }}>
                    <p className="cb-microlabel">Attachment</p>
                    <div className="mt-2">
                      <a href={docUrl} target="_blank" rel="noreferrer">
                        <CbButton size="md" variant="secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Download className="h-4 w-4" /> Open document
                          </span>
                        </CbButton>
                      </a>
                    </div>
                  </CbCard>
                ) : null}

                {lesson.kind !== "video" && lesson.kind !== "quiz" && !done ? (
                  <CbButton
                    block
                    onClick={async () => {
                      await markRead();
                      await onCourseCheck();
                    }}
                  >
                    Mark as complete
                  </CbButton>
                ) : null}

                {next ? (
                  <CbButton
                    block
                    variant="secondary"
                    onClick={() => navigate({ to: "/cb/training/lesson/$id", params: { id: next.id } })}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Next lesson <ChevronRight className="h-4 w-4" />
                    </span>
                  </CbButton>
                ) : null}
              </div>

              {course.data?.course ? (
                <CbTutor courseId={lesson.course_id} courseTitle={course.data.course.title} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </CbSurface>
  );
}
