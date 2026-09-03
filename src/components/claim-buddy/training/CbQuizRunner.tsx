import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CbButton, CbCard, CbBadge } from "@/components/cb/primitives";
import { cbGradeAnswers } from "@/lib/cb-training.functions";
import { awardPoints, logEvent, useTrainingScope } from "@/hooks/useCbTraining";
import type { CbQuiz, CbQuizQuestion } from "@/lib/cbTraining";

interface GradeFeedback {
  index: number;
  score: number;
  feedback: string;
  follow_up: string | null;
}

/** Runs a quiz: multiple choice scored locally, free text graded by AI. */
export function CbQuizRunner({
  lessonId,
  courseId,
  onPassed,
}: {
  lessonId: string;
  courseId: string;
  onPassed?: () => void;
}) {
  const { user } = useAuth();
  const { workspaceId } = useTrainingScope();

  const [quiz, setQuiz] = useState<CbQuiz | null>(null);
  const [questions, setQuestions] = useState<CbQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ percent: number; passed: boolean; notes: GradeFeedback[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: q } = await supabase
        .from("cb_quizzes")
        .select("*")
        .eq("lesson_id", lessonId)
        .maybeSingle();
      if (cancelled) return;
      const quizRow = (q ?? null) as unknown as CbQuiz | null;
      setQuiz(quizRow);
      if (quizRow) {
        const { data: qs } = await supabase
          .from("cb_quiz_questions")
          .select("*")
          .eq("quiz_id", quizRow.id)
          .order("sort_order");
        if (!cancelled) setQuestions((qs ?? []) as unknown as CbQuizQuestion[]);
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  const totalPoints = useMemo(
    () => questions.reduce((s, q) => s + (q.points || 1), 0) || 1,
    [questions],
  );

  async function submit() {
    if (!quiz || !workspaceId || !user?.id) return;
    setSubmitting(true);
    try {
      let earned = 0;
      const textItems: { index: number; q: CbQuizQuestion; answer: string }[] = [];

      questions.forEach((q, i) => {
        const a = answers[q.id];
        if (q.kind === "choice") {
          if (typeof a === "number" && a === q.correct_index) earned += q.points || 1;
        } else if (typeof a === "string" && a.trim()) {
          textItems.push({ index: i, q, answer: a });
        }
      });

      let notes: GradeFeedback[] = [];
      if (textItems.length) {
        const res = await cbGradeAnswers({
          data: {
            workspaceId,
            items: textItems.map((t) => ({
              prompt: t.q.prompt,
              model_answer: t.q.model_answer,
              answer: t.answer,
            })),
          },
        });
        if (res.ok) {
          notes = res.grades.map((g) => ({ ...g, index: textItems[g.index]?.index ?? g.index }));
          res.grades.forEach((g) => {
            const item = textItems[g.index];
            if (item) earned += ((g.score ?? 0) / 100) * (item.q.points || 1);
          });
        } else {
          toast.error(res.error);
        }
      }

      const percent = Math.round((earned / totalPoints) * 100);
      const passed = percent >= (quiz.pass_percent ?? 70);

      await supabase.from("cb_quiz_attempts").insert({
        quiz_id: quiz.id,
        workspace_id: workspaceId,
        user_id: user.id,
        answers: answers as Json,
        feedback: notes as Json,
        score_percent: percent,
        passed,
        submitted_at: new Date().toISOString(),
      });

      if (passed) {
        await awardPoints(workspaceId, user.id, percent === 100 ? "quiz_perfect" : "quiz_pass", quiz.id);
        await supabase.from("cb_progress").upsert(
          {
            workspace_id: workspaceId,
            lesson_id: lessonId,
            course_id: courseId,
            user_id: user.id,
            percent: 100,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "lesson_id,user_id" },
        );
        onPassed?.();
      }
      await logEvent({
        workspaceId,
        userId: user.id,
        kind: "quiz_attempt",
        courseId,
        lessonId,
        meta: { percent, passed },
      });

      setResult({ percent, passed, notes });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit the quiz");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>Loading quiz…</p>;
  if (!quiz)
    return (
      <CbCard elevation="card" style={{ padding: 18 }}>
        <p className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
          No quiz has been added to this lesson yet.
        </p>
      </CbCard>
    );

  return (
    <div className="space-y-4">
      <CbCard elevation="card" style={{ padding: 18 }}>
        <p className="cb-microlabel">Quiz</p>
        <p className="mt-1 text-[17px] font-semibold">{quiz.title}</p>
        {quiz.instructions ? (
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
            {quiz.instructions}
          </p>
        ) : null}
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
          Pass mark {quiz.pass_percent}%
        </p>
      </CbCard>

      {questions.map((q, i) => {
        const note = result?.notes.find((n) => n.index === i);
        return (
          <CbCard key={q.id} elevation="card" style={{ padding: 18 }}>
            <p className="text-[15px] font-semibold">
              {i + 1}. {q.prompt}
            </p>
            {q.kind === "choice" ? (
              <div className="mt-3 space-y-2">
                {(q.options ?? []).map((opt, oi) => {
                  const chosen = answers[q.id] === oi;
                  const reveal = !!result;
                  const isCorrect = reveal && oi === q.correct_index;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={!!result}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                      className="w-full rounded-[12px] px-3 py-3 text-left text-[14px]"
                      style={{
                        border: `1px solid ${
                          isCorrect
                            ? "var(--cb-success, #15803d)"
                            : chosen
                              ? "var(--cb-accent)"
                              : "var(--cb-hairline, rgba(0,0,0,.12))"
                        }`,
                        background: chosen
                          ? "color-mix(in oklab, var(--cb-accent) 12%, transparent)"
                          : "transparent",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                className="mt-3 w-full rounded-[12px] p-3 text-[14px]"
                rows={4}
                disabled={!!result}
                placeholder="Type your answer…"
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                style={{ border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))", background: "transparent" }}
              />
            )}
            {note ? (
              <div className="mt-3 rounded-[12px] p-3" style={{ background: "rgba(0,0,0,.04)" }}>
                <p className="text-[12.5px] font-semibold">Scored {Math.round(note.score)}%</p>
                <p className="text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                  {note.feedback}
                </p>
                {note.follow_up ? (
                  <p className="mt-1 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                    Think about: {note.follow_up}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CbCard>
        );
      })}

      {result ? (
        <CbCard elevation="raised" style={{ padding: 18 }}>
          <div className="flex items-center justify-between">
            <p className="text-[17px] font-semibold">{result.percent}%</p>
            <CbBadge tone={result.passed ? "success" : "danger"}>{result.passed ? "Passed" : "Not yet"}</CbBadge>
          </div>
          {!result.passed ? (
            <div className="mt-3">
              <CbButton
                size="md"
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
              >
                Try again
              </CbButton>
            </div>
          ) : null}
        </CbCard>
      ) : (
        <CbButton block loading={submitting} loadingText="Grading…" onClick={submit}>
          Submit quiz
        </CbButton>
      )}
    </div>
  );
}
