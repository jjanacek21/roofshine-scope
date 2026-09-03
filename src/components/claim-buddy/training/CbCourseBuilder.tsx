import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { CbCard, CbButton, CbBadge } from "@/components/cb/primitives";
import { cbGenerateQuiz } from "@/lib/cb-training.functions";
import { useCbCourse, useInvalidateTraining, useTrainingScope } from "@/hooks/useCbTraining";
import type { CbCheckpoint, CbLesson, CbLessonKind } from "@/lib/cbTraining";

const input = {
  border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))",
  background: "transparent",
} as const;

type CoursePatch = {
  title?: string;
  description?: string;
  status?: string;
  archived_at?: string | null;
};

type CheckpointPatch = {
  at_seconds?: number;
  question?: string;
  options?: Json;
  correct_index?: number | null;
  branch_seconds?: number | null;
};

const KINDS: { key: CbLessonKind; label: string }[] = [
  { key: "video", label: "Video" },
  { key: "article", label: "Text" },
  { key: "document", label: "Document" },
  { key: "quiz", label: "Quiz" },
  { key: "live", label: "Live" },
];

/** Full course editor: modules, lessons, uploads, checkpoints and quizzes. */
export function CbCourseBuilder({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const { workspaceId } = useTrainingScope();
  const invalidate = useInvalidateTraining();
  const { data, isLoading, refetch } = useCbCourse(courseId);
  const [busy, setBusy] = useState(false);
  const [openLesson, setOpenLesson] = useState<string | null>(null);

  const course = data?.course ?? null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (course) {
      setTitle(course.title);
      setDescription(course.description ?? "");
    }
  }, [course?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveCourse(patch: CoursePatch) {
    const { error } = await supabase.from("cb_courses").update(patch).eq("id", courseId);
    if (error) toast.error(error.message);
    else {
      await refetch();
      invalidate();
    }
  }

  async function addModule() {
    if (!workspaceId) return;
    setBusy(true);
    const { error } = await supabase.from("cb_modules").insert({
      workspace_id: workspaceId,
      course_id: courseId,
      title: `Module ${(data?.modules?.length ?? 0) + 1}`,
      sort_order: data?.modules?.length ?? 0,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else void refetch();
  }

  async function addLesson(moduleId: string, count: number) {
    if (!workspaceId) return;
    const { error } = await supabase.from("cb_lessons").insert({
      workspace_id: workspaceId,
      course_id: courseId,
      module_id: moduleId,
      title: `Lesson ${count + 1}`,
      kind: "article",
      sort_order: count,
    });
    if (error) toast.error(error.message);
    else void refetch();
  }

  async function removeRow(table: "cb_modules" | "cb_lessons", id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else void refetch();
  }

  async function moveLesson(lesson: CbLesson, dir: -1 | 1) {
    const siblings = (data?.lessons ?? []).filter((l) => l.module_id === lesson.module_id);
    const i = siblings.findIndex((l) => l.id === lesson.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    await Promise.all([
      supabase.from("cb_lessons").update({ sort_order: j }).eq("id", lesson.id),
      supabase.from("cb_lessons").update({ sort_order: i }).eq("id", siblings[j].id),
    ]);
    void refetch();
  }

  if (isLoading || !course) {
    return (
      <CbCard elevation="card" style={{ padding: 18 }}>
        <p className="text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
          Loading course…
        </p>
      </CbCard>
    );
  }

  return (
    <div className="space-y-4">
      <CbCard elevation="raised" style={{ padding: 18 }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <input
              className="w-full rounded-[12px] px-3 py-2 text-[16px] font-semibold"
              style={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== course.title && saveCourse({ title })}
            />
            <textarea
              className="w-full rounded-[12px] px-3 py-2 text-[14px]"
              style={input}
              rows={2}
              placeholder="What will they learn?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (course.description ?? "") && saveCourse({ description })}
            />
          </div>
          <CbBadge tone={course.status === "published" ? "success" : "warning"}>
            {course.status === "published" ? "Published" : "Draft"}
          </CbBadge>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <CbButton
            size="md"
            variant={course.status === "published" ? "secondary" : "primary"}
            onClick={() => saveCourse({ status: course.status === "published" ? "draft" : "published" })}
          >
            {course.status === "published" ? "Unpublish" : "Publish to the team"}
          </CbButton>
          <CbButton size="md" variant="secondary" loading={busy} onClick={addModule}>
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Add module
            </span>
          </CbButton>
          <CbButton
            size="md"
            variant="ghost"
            onClick={() => saveCourse({ archived_at: new Date().toISOString() }).then(onClose)}
          >
            Archive
          </CbButton>
          <CbButton size="md" variant="ghost" onClick={onClose}>
            Done
          </CbButton>
        </div>
      </CbCard>

      {(data?.modules ?? []).map((mod) => {
        const lessons = (data?.lessons ?? []).filter((l) => l.module_id === mod.id);
        return (
          <CbCard key={mod.id} elevation="card" style={{ padding: 16 }}>
            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded-[10px] px-2 py-1.5 text-[14.5px] font-semibold"
                style={input}
                defaultValue={mod.title}
                onBlur={(e) =>
                  supabase.from("cb_modules").update({ title: e.target.value }).eq("id", mod.id).then(() => refetch())
                }
              />
              <button type="button" onClick={() => removeRow("cb_modules", mod.id)} aria-label="Delete module">
                <Trash2 className="h-4 w-4" style={{ color: "var(--cb-text-muted)" }} />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {lessons.map((l) => (
                <div key={l.id}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate rounded-[10px] px-2 py-2 text-left text-[14px]"
                      style={{ background: openLesson === l.id ? "rgba(0,0,0,.04)" : "transparent" }}
                      onClick={() => setOpenLesson(openLesson === l.id ? null : l.id)}
                    >
                      {l.title} <span style={{ color: "var(--cb-text-muted)" }}>· {l.kind}</span>
                    </button>
                    <button type="button" onClick={() => moveLesson(l, -1)} aria-label="Move up">
                      <ChevronUp className="h-4 w-4" style={{ color: "var(--cb-text-muted)" }} />
                    </button>
                    <button type="button" onClick={() => moveLesson(l, 1)} aria-label="Move down">
                      <ChevronDown className="h-4 w-4" style={{ color: "var(--cb-text-muted)" }} />
                    </button>
                    <button type="button" onClick={() => removeRow("cb_lessons", l.id)} aria-label="Delete lesson">
                      <Trash2 className="h-4 w-4" style={{ color: "var(--cb-text-muted)" }} />
                    </button>
                  </div>
                  {openLesson === l.id ? <LessonEditor lesson={l} onSaved={() => refetch()} /> : null}
                </div>
              ))}
              <CbButton size="md" variant="secondary" onClick={() => addLesson(mod.id, lessons.length)}>
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> Add lesson
                </span>
              </CbButton>
            </div>
          </CbCard>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LessonEditor({ lesson, onSaved }: { lesson: CbLesson; onSaved: () => void }) {
  const { workspaceId } = useTrainingScope();
  const [draft, setDraft] = useState<CbLesson>(lesson);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const docRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setDraft(lesson), [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("cb_lessons")
      .update({
        title: draft.title,
        kind: draft.kind,
        body: draft.body,
        video_url: draft.video_url,
        video_path: draft.video_path,
        document_path: draft.document_path,
        duration_seconds: draft.duration_seconds,
        transcript: draft.transcript,
        required_percent: draft.required_percent,
      })
      .eq("id", lesson.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Lesson saved");
      onSaved();
    }
  }

  async function upload(file: File, kind: "video" | "doc") {
    if (!workspaceId) return;
    setUploading(true);
    const path = `${workspaceId}/${lesson.course_id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("cb-training").upload(path, file, { upsert: false });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft((d) => (kind === "video" ? { ...d, video_path: path, kind: "video" } : { ...d, document_path: path }));
    toast.success("Uploaded — remember to save the lesson.");
  }

  return (
    <div className="mt-2 space-y-3 rounded-[12px] p-3" style={{ background: "rgba(0,0,0,.03)" }}>
      <input
        className="w-full rounded-[10px] px-3 py-2 text-[14px]"
        style={input}
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      />

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className="cb-chip"
            onClick={() => setDraft({ ...draft, kind: k.key })}
            aria-pressed={draft.kind === k.key}
            style={draft.kind === k.key ? { background: "var(--cb-accent)", color: "#fff", borderColor: "transparent" } : undefined}
          >
            {k.label}
          </button>
        ))}
      </div>

      {draft.kind === "video" ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-[10px] px-3 py-2 text-[14px]"
            style={input}
            placeholder="YouTube / Vimeo / Loom / direct MP4 link"
            value={draft.video_url ?? ""}
            onChange={(e) => setDraft({ ...draft, video_url: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "video")}
            />
            <CbButton size="md" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
              <span className="inline-flex items-center gap-1.5">
                <Upload className="h-4 w-4" /> Upload video
              </span>
            </CbButton>
            {draft.video_path ? <CbBadge tone="success">File attached</CbBadge> : null}
            <input
              type="number"
              className="w-28 rounded-[10px] px-3 py-2 text-[14px]"
              style={input}
              placeholder="Seconds"
              value={draft.duration_seconds ?? ""}
              onChange={(e) => setDraft({ ...draft, duration_seconds: Number(e.target.value) || null })}
            />
            <input
              type="number"
              className="w-28 rounded-[10px] px-3 py-2 text-[14px]"
              style={input}
              placeholder="% required"
              value={draft.required_percent ?? 80}
              onChange={(e) => setDraft({ ...draft, required_percent: Number(e.target.value) || 80 })}
            />
          </div>
          <CheckpointEditor lesson={lesson} />
        </div>
      ) : null}

      {draft.kind === "document" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={docRef}
            type="file"
            accept="application/pdf,image/*,.doc,.docx"
            hidden
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "doc")}
          />
          <CbButton size="md" variant="secondary" loading={uploading} onClick={() => docRef.current?.click()}>
            <span className="inline-flex items-center gap-1.5">
              <Upload className="h-4 w-4" /> Upload document
            </span>
          </CbButton>
          {draft.document_path ? <CbBadge tone="success">File attached</CbBadge> : null}
        </div>
      ) : null}

      {draft.kind === "quiz" ? <QuizEditor lesson={lesson} /> : null}

      <textarea
        className="w-full rounded-[10px] px-3 py-2 text-[14px]"
        style={input}
        rows={6}
        placeholder={draft.kind === "video" ? "Notes or transcript shown under the video" : "Lesson text (markdown ok)"}
        value={draft.body ?? ""}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
      />

      <CbButton size="md" loading={saving} onClick={save}>
        Save lesson
      </CbButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CheckpointEditor({ lesson }: { lesson: CbLesson }) {
  const { workspaceId } = useTrainingScope();
  const [rows, setRows] = useState<CbCheckpoint[]>([]);

  async function load() {
    const { data } = await supabase
      .from("cb_video_checkpoints")
      .select("*")
      .eq("lesson_id", lesson.id)
      .order("at_seconds");
    setRows((data ?? []) as unknown as CbCheckpoint[]);
  }

  useEffect(() => {
    void load();
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!workspaceId) return;
    await supabase.from("cb_video_checkpoints").insert({
      workspace_id: workspaceId,
      lesson_id: lesson.id,
      at_seconds: 30,
      question: "What was the key point?",
      options: ["Option A", "Option B", "Option C"],
      correct_index: 0,
      required: true,
    });
    void load();
  }

  async function patch(id: string, values: CheckpointPatch) {
    await supabase.from("cb_video_checkpoints").update(values).eq("id", id);
    void load();
  }

  return (
    <div className="space-y-2">
      <p className="cb-microlabel">Checkpoints</p>
      {rows.map((c) => (
        <div key={c.id} className="space-y-2 rounded-[10px] p-2" style={{ background: "rgba(0,0,0,.03)" }}>
          <div className="flex gap-2">
            <input
              type="number"
              className="w-24 rounded-[10px] px-2 py-1.5 text-[13px]"
              style={input}
              defaultValue={c.at_seconds}
              onBlur={(e) => patch(c.id, { at_seconds: Number(e.target.value) || 0 })}
            />
            <input
              className="min-w-0 flex-1 rounded-[10px] px-2 py-1.5 text-[13px]"
              style={input}
              defaultValue={c.question}
              onBlur={(e) => patch(c.id, { question: e.target.value })}
            />
            <button
              type="button"
              onClick={async () => {
                await supabase.from("cb_video_checkpoints").delete().eq("id", c.id);
                void load();
              }}
              aria-label="Delete checkpoint"
            >
              <Trash2 className="h-4 w-4" style={{ color: "var(--cb-text-muted)" }} />
            </button>
          </div>
          <input
            className="w-full rounded-[10px] px-2 py-1.5 text-[13px]"
            style={input}
            defaultValue={(c.options ?? []).join(" | ")}
            placeholder="Options separated by |"
            onBlur={(e) =>
              patch(c.id, { options: e.target.value.split("|").map((s) => s.trim()).filter(Boolean) })
            }
          />
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              className="w-32 rounded-[10px] px-2 py-1.5 text-[13px]"
              style={input}
              defaultValue={c.correct_index ?? 0}
              placeholder="Correct #"
              onBlur={(e) => patch(c.id, { correct_index: Number(e.target.value) })}
            />
            <input
              type="number"
              className="w-40 rounded-[10px] px-2 py-1.5 text-[13px]"
              style={input}
              defaultValue={c.branch_seconds ?? ""}
              placeholder="Rewind to (sec)"
              onBlur={(e) => patch(c.id, { branch_seconds: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
        </div>
      ))}
      <CbButton size="md" variant="secondary" onClick={add}>
        <span className="inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Add checkpoint
        </span>
      </CbButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QuizEditor({ lesson }: { lesson: CbLesson }) {
  const { workspaceId } = useTrainingScope();
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<{ id: string; prompt: string; kind: string; options: string[]; correct_index: number | null }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [material, setMaterial] = useState("");

  async function load() {
    if (!workspaceId) return;
    let { data: quiz } = await supabase.from("cb_quizzes").select("*").eq("lesson_id", lesson.id).maybeSingle();
    if (!quiz) {
      const { data: created } = await supabase
        .from("cb_quizzes")
        .insert({
          workspace_id: workspaceId,
          lesson_id: lesson.id,
          course_id: lesson.course_id,
          title: lesson.title,
          pass_percent: 70,
        })
        .select("*")
        .maybeSingle();
      quiz = created;
    }
    if (!quiz) return;
    setQuizId(quiz.id as string);
    const { data: qs } = await supabase
      .from("cb_quiz_questions")
      .select("id, prompt, kind, options, correct_index")
      .eq("quiz_id", quiz.id)
      .order("sort_order");
    setQuestions(
      (qs ?? []).map((q) => ({
        id: q.id as string,
        prompt: q.prompt as string,
        kind: q.kind as string,
        options: (q.options ?? []) as string[],
        correct_index: q.correct_index as number | null,
      })),
    );
  }

  useEffect(() => {
    void load();
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (!workspaceId || !quizId) return;
    const source = material.trim() || lesson.body || lesson.transcript || "";
    if (!source) {
      toast.error("Paste the material to build questions from.");
      return;
    }
    setGenerating(true);
    try {
      const res = await cbGenerateQuiz({ data: { workspaceId, material: source, count: 6, includeText: true } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const rows = res.questions.map((q, i) => ({
        quiz_id: quizId,
        workspace_id: workspaceId,
        prompt: q.prompt,
        kind: q.kind,
        options: q.options ?? [],
        correct_index: q.correct_index,
        model_answer: q.model_answer,
        points: 1,
        sort_order: questions.length + i,
      }));
      const { error } = await supabase.from("cb_quiz_questions").insert(rows);
      if (error) toast.error(error.message);
      else {
        toast.success(`Added ${rows.length} questions`);
        void load();
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="cb-microlabel">Quiz questions</p>
      {questions.map((q, i) => (
        <div key={q.id} className="flex items-center gap-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate">
            {i + 1}. {q.prompt}
          </span>
          <button
            type="button"
            onClick={async () => {
              await supabase.from("cb_quiz_questions").delete().eq("id", q.id);
              void load();
            }}
            aria-label="Delete question"
          >
            <Trash2 className="h-4 w-4" style={{ color: "var(--cb-text-muted)" }} />
          </button>
        </div>
      ))}
      <textarea
        className="w-full rounded-[10px] px-3 py-2 text-[13px]"
        style={input}
        rows={3}
        placeholder="Paste the material the quiz should test (leave blank to use the lesson text)"
        value={material}
        onChange={(e) => setMaterial(e.target.value)}
      />
      <CbButton size="md" variant="secondary" loading={generating} loadingText="Writing questions…" onClick={generate}>
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" /> Generate questions with AI
        </span>
      </CbButton>
    </div>
  );
}
