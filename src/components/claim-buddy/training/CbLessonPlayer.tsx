import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CbButton, CbCard, CbBadge } from "@/components/cb/primitives";
import {
  embedUrl,
  formatDuration,
  isDirectVideo,
  mergeRanges,
  rangeSeconds,
  watchPercent,
  type CbCheckpoint,
  type CbLesson,
  type CbProgress,
} from "@/lib/cbTraining";
import { awardPoints, logEvent, useTrainingScope } from "@/hooks/useCbTraining";

/**
 * Video lesson player with real watch tracking.
 *
 * Watched time is stored as merged [start, end] ranges rather than a max
 * position, so skipping ahead never counts as watching. Checkpoints pause the
 * video, ask a question and can branch back to an earlier timestamp.
 */
export function CbLessonPlayer({
  lesson,
  checkpoints,
  onComplete,
  onBranchLesson,
}: {
  lesson: CbLesson;
  checkpoints: CbCheckpoint[];
  onComplete?: () => void;
  onBranchLesson?: (lessonId: string) => void;
}) {
  const { user } = useAuth();
  const { workspaceId } = useTrainingScope();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [ranges, setRanges] = useState<[number, number][]>([]);
  const [duration, setDuration] = useState<number>(lesson.duration_seconds ?? 0);
  const [active, setActive] = useState<CbCheckpoint | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);
  const [manualSeconds, setManualSeconds] = useState(0);

  const lastTick = useRef<number | null>(null);
  const pendingSave = useRef<number | null>(null);
  const progressId = useRef<string | null>(null);

  const embed = useMemo(() => embedUrl(lesson.video_url), [lesson.video_url]);
  const required = lesson.required_percent ?? 80;

  /* Resolve a playable source: uploaded file gets a signed URL. */
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (lesson.video_path) {
        const { data } = await supabase.storage
          .from("cb-training")
          .createSignedUrl(lesson.video_path, 60 * 60 * 4);
        if (!cancelled) setSrc(data?.signedUrl ?? null);
        return;
      }
      if (isDirectVideo(lesson.video_url)) setSrc(lesson.video_url);
      else setSrc(null);
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [lesson.video_path, lesson.video_url]);

  /* Load existing progress. */
  useEffect(() => {
    if (!workspaceId || !user?.id) return;
    let cancelled = false;
    void supabase
      .from("cb_progress")
      .select("*")
      .eq("lesson_id", lesson.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as unknown as CbProgress;
        progressId.current = row.id;
        setRanges(mergeRanges((row.ranges ?? []) as [number, number][]));
        setCompleted(!!row.completed_at);
        setAnswered(new Set((row.checkpoint_answers ?? []).map((a) => a.checkpoint_id)));
        if (videoRef.current && row.last_position_seconds) {
          videoRef.current.currentTime = row.last_position_seconds;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.id, user?.id, workspaceId]);

  const save = useCallback(
    async (next: [number, number][], position: number, answers?: CbProgress["checkpoint_answers"]) => {
      if (!workspaceId || !user?.id) return;
      const watched = rangeSeconds(next);
      const pct = watchPercent(next, duration || lesson.duration_seconds);
      const isDone = pct >= required;

      const payload = {
        workspace_id: workspaceId,
        lesson_id: lesson.id,
        course_id: lesson.course_id,
        user_id: user.id,
        ranges: next,
        watched_seconds: watched,
        percent: pct,
        last_position_seconds: Math.round(position),
        ...(answers ? { checkpoint_answers: answers } : {}),
        ...(isDone && !completed ? { completed_at: new Date().toISOString() } : {}),
      };

      const { data, error } = await supabase
        .from("cb_progress")
        .upsert(payload, { onConflict: "lesson_id,user_id" })
        .select("id")
        .maybeSingle();
      if (error) return;
      if (data) progressId.current = data.id as string;

      if (isDone && !completed) {
        setCompleted(true);
        await awardPoints(workspaceId, user.id, "lesson_complete", lesson.id);
        await logEvent({
          workspaceId,
          userId: user.id,
          kind: "lesson_complete",
          courseId: lesson.course_id,
          lessonId: lesson.id,
        });
        toast.success("Lesson complete");
        onComplete?.();
      }
    },
    [workspaceId, user?.id, lesson, duration, required, completed, onComplete],
  );

  /* Flush watch time to the server at most every 10 seconds. */
  const queueSave = useCallback(
    (next: [number, number][], position: number) => {
      const now = Date.now();
      if (pendingSave.current && now - pendingSave.current < 10000) return;
      pendingSave.current = now;
      void save(next, position);
    },
    [save],
  );

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || v.paused) return;
    const t = v.currentTime;
    const prev = lastTick.current;
    lastTick.current = t;
    if (prev === null) return;
    const delta = t - prev;
    if (delta <= 0 || delta > 2) return; // a seek, not playback

    const next = mergeRanges([...ranges, [prev, t]]);
    setRanges(next);
    queueSave(next, t);

    /* Checkpoints fire once, in order. */
    const due = checkpoints.find(
      (c) => !answered.has(c.id) && c.at_seconds > prev && c.at_seconds <= t,
    );
    if (due) {
      v.pause();
      setPicked(null);
      setActive(due);
    }
  }

  async function submitCheckpoint() {
    if (!active) return;
    const correct = active.correct_index === null || picked === active.correct_index;
    const nextAnswered = new Set(answered);
    nextAnswered.add(active.id);
    setAnswered(nextAnswered);

    const answers = [...nextAnswered].map((id) => ({
      checkpoint_id: id,
      answer: id === active.id ? (picked ?? -1) : -1,
      correct: id === active.id ? correct : true,
    }));
    await save(ranges, videoRef.current?.currentTime ?? 0, answers);

    if (!correct && active.branch_lesson_id && onBranchLesson) {
      const target = active.branch_lesson_id;
      setActive(null);
      toast.info("Let's cover that again first.");
      onBranchLesson(target);
      return;
    }
    if (!correct && active.branch_seconds !== null && videoRef.current) {
      videoRef.current.currentTime = active.branch_seconds;
      lastTick.current = active.branch_seconds;
      toast.info("Rewinding to that part.");
    }
    setActive(null);
    void videoRef.current?.play();
  }

  /* Non-trackable embeds: count wall-clock time while the tab is visible. */
  useEffect(() => {
    if (src || !embed) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setManualSeconds((s) => s + 5);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [src, embed]);

  async function markWatched() {
    if (!workspaceId || !user?.id) return;
    const total = lesson.duration_seconds || Math.max(manualSeconds, 60);
    const next: [number, number][] = [[0, total]];
    setRanges(next);
    await save(next, total);
    await logEvent({
      workspaceId,
      userId: user.id,
      kind: "watch",
      courseId: lesson.course_id,
      lessonId: lesson.id,
      seconds: Math.max(manualSeconds, 30),
    });
  }

  /* Log watch seconds when leaving the lesson. */
  useEffect(() => {
    return () => {
      const watched = rangeSeconds(ranges);
      if (!workspaceId || !user?.id || watched <= 0) return;
      void logEvent({
        workspaceId,
        userId: user.id,
        kind: "watch",
        courseId: lesson.course_id,
        lessonId: lesson.id,
        seconds: watched,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const pct = watchPercent(ranges, duration || lesson.duration_seconds);

  return (
    <div className="space-y-3">
      <CbCard elevation="raised" style={{ padding: 0, overflow: "hidden" }}>
        {src ? (
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            className="w-full"
            style={{ display: "block", background: "#000", maxHeight: "62vh" }}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            onTimeUpdate={handleTimeUpdate}
            onPause={() => {
              lastTick.current = null;
              void save(ranges, videoRef.current?.currentTime ?? 0);
            }}
            onEnded={() => void save(ranges, duration)}
          />
        ) : embed ? (
          <div style={{ aspectRatio: "16 / 9", background: "#000" }}>
            <iframe
              src={embed}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </div>
        ) : (
          <div className="p-6 text-center text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
            No video attached to this lesson yet.
          </div>
        )}
      </CbCard>

      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,.08)" }}>
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${pct}%`, background: "var(--cb-accent)" }}
          />
        </div>
        <span className="text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
          {pct}% of {formatDuration(duration || lesson.duration_seconds)}
        </span>
        {completed ? <CbBadge tone="success">Complete</CbBadge> : null}
      </div>

      {!src && embed && !completed ? (
        <CbButton size="md" variant="secondary" onClick={markWatched}>
          I finished this video
        </CbButton>
      ) : null}

      {active ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
          style={{ background: "rgba(0,0,0,.5)" }}
        >
          <CbCard elevation="floating" className="w-full max-w-[520px]" style={{ padding: 20 }}>
            <p className="cb-microlabel">Checkpoint</p>
            <p className="mt-2 text-[16px] font-semibold">{active.question}</p>
            <div className="mt-3 space-y-2">
              {(active.options ?? []).map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPicked(i)}
                  className="w-full rounded-[12px] px-3 py-3 text-left text-[14px]"
                  style={{
                    border: `1px solid ${picked === i ? "var(--cb-accent)" : "var(--cb-hairline, rgba(0,0,0,.12))"}`,
                    background: picked === i ? "color-mix(in oklab, var(--cb-accent) 12%, transparent)" : "transparent",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            {active.explanation ? (
              <p className="mt-3 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                {active.explanation}
              </p>
            ) : null}
            <div className="mt-4">
              <CbButton block disabled={picked === null && (active.options ?? []).length > 0} onClick={submitCheckpoint}>
                Continue
              </CbButton>
            </div>
          </CbCard>
        </div>
      ) : null}
    </div>
  );
}
