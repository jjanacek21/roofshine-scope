/**
 * Company Training — shared types and pure helpers.
 *
 * Watch tracking is range based on purpose: the player reports the seconds it
 * actually played, so seeking to the end can never mark a lesson complete.
 */

export type CbLessonKind = "video" | "article" | "document" | "quiz" | "live";
export type CbCourseStatus = "draft" | "published";

export interface CbCourse {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  category: string | null;
  status: CbCourseStatus;
  sort_order: number;
  prerequisite_course_id: string | null;
  estimated_minutes: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CbModule {
  id: string;
  course_id: string;
  workspace_id: string;
  title: string;
  summary: string | null;
  sort_order: number;
}

export interface CbLesson {
  id: string;
  module_id: string;
  course_id: string;
  workspace_id: string;
  title: string;
  kind: CbLessonKind;
  body: string | null;
  video_url: string | null;
  video_provider: string | null;
  video_path: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  document_path: string | null;
  required_percent: number;
  sort_order: number;
}

export interface CbCheckpoint {
  id: string;
  lesson_id: string;
  workspace_id: string;
  at_seconds: number;
  question: string;
  options: string[];
  correct_index: number | null;
  explanation: string | null;
  branch_seconds: number | null;
  branch_lesson_id: string | null;
  required: boolean;
}

export interface CbQuiz {
  id: string;
  workspace_id: string;
  lesson_id: string | null;
  course_id: string | null;
  title: string;
  instructions: string | null;
  pass_percent: number;
  mode: "standard" | "ai";
}

export interface CbQuizQuestion {
  id: string;
  quiz_id: string;
  workspace_id: string;
  prompt: string;
  kind: "choice" | "text";
  options: string[];
  correct_index: number | null;
  model_answer: string | null;
  points: number;
  sort_order: number;
}

export interface CbProgress {
  id: string;
  workspace_id: string;
  lesson_id: string;
  course_id: string;
  user_id: string;
  ranges: [number, number][];
  watched_seconds: number;
  percent: number;
  last_position_seconds: number;
  checkpoint_answers: { checkpoint_id: string; answer: number; correct: boolean }[];
  completed_at: string | null;
}

export interface CbAssignment {
  id: string;
  workspace_id: string;
  course_id: string;
  audience: "all" | "role" | "user";
  role: string | null;
  user_id: string | null;
  due_at: string | null;
}

export interface CbLiveSession {
  id: string;
  workspace_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  meet_url: string | null;
  google_event_id: string | null;
  recurrence: string | null;
  counts_toward_hours: boolean;
}

export interface CbTrainingRule {
  id: string;
  workspace_id: string;
  role: string;
  period: "week" | "month";
  required_minutes: number;
}

/* ------------------------------------------------------------------ */
/* Watched-range math                                                  */
/* ------------------------------------------------------------------ */

/** Merges overlapping/adjacent [start, end] second ranges. */
export function mergeRanges(input: [number, number][]): [number, number][] {
  const clean = input
    .map(([a, b]) => [Math.max(0, Math.floor(Math.min(a, b))), Math.max(0, Math.ceil(Math.max(a, b)))] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const r of clean) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function rangeSeconds(ranges: [number, number][]): number {
  return ranges.reduce((sum, [a, b]) => sum + (b - a), 0);
}

export function watchPercent(ranges: [number, number][], duration: number | null | undefined): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.round((rangeSeconds(ranges) / duration) * 100));
}

/* ------------------------------------------------------------------ */
/* Points                                                              */
/* ------------------------------------------------------------------ */

export const CB_POINTS = {
  lesson_complete: 10,
  course_complete: 50,
  quiz_pass: 25,
  quiz_perfect: 40,
  live_attend: 20,
  watch_10_minutes: 5,
} as const;

export type CbPointReason = keyof typeof CB_POINTS;

export const CB_POINT_LABEL: Record<CbPointReason, string> = {
  lesson_complete: "Lesson completed",
  course_complete: "Course completed",
  quiz_pass: "Quiz passed",
  quiz_perfect: "Perfect quiz",
  live_attend: "Live session attended",
  watch_10_minutes: "10 minutes watched",
};

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Monday 00:00 of the week containing `d`, in local time. */
export function startOfWeek(d = new Date()): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function startOfMonth(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(1);
  return x;
}

/** Turns a YouTube / Vimeo / Loom URL into an embeddable src, or null. */
export function embedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  const lm = u.match(/loom\.com\/share\/([\w-]+)/);
  if (lm) return `https://www.loom.com/embed/${lm[1]}`;
  return null;
}

/** True when the URL points at a file we can play in a <video> element. */
export function isDirectVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);
}
