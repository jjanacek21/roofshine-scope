import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AiGrade, AiOutline, AiQuizQuestion } from "@/lib/cb-training-ai.server";

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string };

function fail(e: unknown): Fail {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

/** Throws unless the caller is an owner/admin of the workspace. */
async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  workspaceId: string,
) {
  const { data } = await supabase.rpc("cb_is_admin", { _ws: workspaceId });
  if (data !== true) throw new Error("Only company owners and admins can do that.");
}

async function assertMember(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  workspaceId: string,
) {
  const { data } = await supabase.rpc("cb_role", { _ws: workspaceId });
  if (!data) throw new Error("You are not a member of this company.");
}

/* ---------------------------------------------------------------- */
/* AI: generate a course outline                                     */
/* ---------------------------------------------------------------- */

export const cbGenerateCourseOutline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    workspaceId: string;
    topic: string;
    audience?: string;
    source?: string;
    moduleCount?: number;
  }) => data)
  .handler(async ({ data, context }): Promise<Ok<{ outline: AiOutline }> | Fail> => {
    try {
      await assertAdmin(context.supabase, data.workspaceId);
      const { generateOutline } = await import("@/lib/cb-training-ai.server");
      return { ok: true, outline: await generateOutline(data) };
    } catch (e) {
      return fail(e);
    }
  });

/* ---------------------------------------------------------------- */
/* AI: generate quiz questions                                       */
/* ---------------------------------------------------------------- */

export const cbGenerateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    workspaceId: string;
    material: string;
    count?: number;
    difficulty?: "easy" | "standard" | "hard";
    includeText?: boolean;
  }) => data)
  .handler(async ({ data, context }): Promise<Ok<{ questions: AiQuizQuestion[] }> | Fail> => {
    try {
      await assertAdmin(context.supabase, data.workspaceId);
      const { generateQuiz } = await import("@/lib/cb-training-ai.server");
      return { ok: true, questions: await generateQuiz(data) };
    } catch (e) {
      return fail(e);
    }
  });

/* ---------------------------------------------------------------- */
/* AI: in-lesson tutor                                               */
/* ---------------------------------------------------------------- */

export const cbTrainingTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    workspaceId: string;
    courseId: string;
    question: string;
    history: { role: "user" | "assistant"; content: string }[];
  }) => data)
  .handler(async ({ data, context }): Promise<Ok<{ reply: string }> | Fail> => {
    try {
      await assertMember(context.supabase, data.workspaceId);

      const { data: course } = await context.supabase
        .from("cb_courses")
        .select("title, description")
        .eq("id", data.courseId)
        .maybeSingle();

      const { data: lessons } = await context.supabase
        .from("cb_lessons")
        .select("title, body, transcript")
        .eq("course_id", data.courseId)
        .order("sort_order");

      const material = [
        course?.description ?? "",
        ...(lessons ?? []).map(
          (l) => `## ${l.title}\n${l.body ?? ""}\n${l.transcript ?? ""}`.trim(),
        ),
      ]
        .filter(Boolean)
        .join("\n\n");

      const { tutorReply } = await import("@/lib/cb-training-ai.server");
      return {
        ok: true,
        reply: await tutorReply({
          material,
          courseTitle: course?.title ?? "this course",
          history: data.history ?? [],
          question: data.question,
        }),
      };
    } catch (e) {
      return fail(e);
    }
  });

/* ---------------------------------------------------------------- */
/* AI: grade free-text answers                                       */
/* ---------------------------------------------------------------- */

export const cbGradeAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    workspaceId: string;
    items: { prompt: string; model_answer: string | null; answer: string }[];
    material?: string;
  }) => data)
  .handler(async ({ data, context }): Promise<Ok<{ grades: AiGrade[] }> | Fail> => {
    try {
      await assertMember(context.supabase, data.workspaceId);
      const { gradeAnswers } = await import("@/lib/cb-training-ai.server");
      return { ok: true, grades: await gradeAnswers(data) };
    } catch (e) {
      return fail(e);
    }
  });

/* ---------------------------------------------------------------- */
/* Save an AI outline as a real course                               */
/* ---------------------------------------------------------------- */

export const cbSaveGeneratedCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { workspaceId: string; outline: AiOutline }) => data)
  .handler(async ({ data, context }): Promise<Ok<{ courseId: string }> | Fail> => {
    try {
      await assertAdmin(context.supabase, data.workspaceId);
      const { supabase, userId } = context;
      const outline = data.outline;

      const { data: course, error: courseErr } = await supabase
        .from("cb_courses")
        .insert({
          workspace_id: data.workspaceId,
          title: outline.title || "Untitled course",
          description: outline.description ?? null,
          status: "draft",
          created_by: userId,
          estimated_minutes: outline.modules.reduce(
            (sum, m) => sum + m.lessons.reduce((s, l) => s + (l.minutes || 5), 0),
            0,
          ),
        })
        .select("id")
        .single();
      if (courseErr) throw courseErr;

      let mi = 0;
      for (const mod of outline.modules ?? []) {
        const { data: created, error: modErr } = await supabase
          .from("cb_modules")
          .insert({
            workspace_id: data.workspaceId,
            course_id: course.id,
            title: mod.title,
            summary: mod.summary ?? null,
            sort_order: mi++,
          })
          .select("id")
          .single();
        if (modErr) throw modErr;

        const lessons = (mod.lessons ?? []).map((l, i) => ({
          workspace_id: data.workspaceId,
          course_id: course.id,
          module_id: created.id,
          title: l.title,
          kind: l.kind === "video" ? "video" : l.kind === "quiz" ? "quiz" : "article",
          body: l.body ?? null,
          sort_order: i,
        }));
        if (lessons.length) {
          const { error: lessonErr } = await supabase.from("cb_lessons").insert(lessons);
          if (lessonErr) throw lessonErr;
        }
      }

      return { ok: true, courseId: course.id };
    } catch (e) {
      return fail(e);
    }
  });
