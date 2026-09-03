# Company Training — a classroom each company builds for its own crew

A second training surface next to the Survival Guide. The Survival Guide stays exactly
as it is (our content, read-only). Company Training is empty on day one and every
company fills it with their own courses, videos, quizzes, live calls and accountability
rules. Available on every plan, Basic included.

Companies can rename it (Crew Training, The Academy, etc.) — the name and cover image
come from company branding.

## What a company owner/admin gets

**Course builder**
- Courses → modules → lessons. A lesson is a video, a text/article, a PDF or document,
  a quiz, or a live session.
- Drag to reorder, publish/draft state, optional prerequisites (must finish Course A
  before B), assign a course to everyone or to specific roles/people, with a due date.
- Duplicate a course, archive a course.

**Video + interactive video**
- Upload video files (stored in the app) or paste a YouTube/Vimeo/Loom link.
- Add checkpoints on the timeline: at 2:14 the video pauses and asks a question.
- Branching: a wrong or specific answer jumps the viewer to another timestamp or lesson
  ("you said the homeowner objects on price — watch this rebuttal first").
- Anti-skip: watched seconds are tracked in ranges, so scrubbing to the end does not
  mark it complete. Completion needs a set % actually watched.

**AI course tools**
- "Generate a course" from a topic or a pasted document/transcript — returns an outline
  with modules, lessons and draft lesson text you edit before publishing.
- "Generate a quiz" from any lesson's video transcript or text, with difficulty control.
- AI tutor chat inside a lesson, answering only from that course's material.
- AI oral/written quiz mode: it asks follow-ups and grades free-text answers with
  feedback, not just multiple choice.

**Live coaching (Google Meet)**
- Connect the company's Google account once. Creating a session auto-generates a Meet
  link and a Calendar invite for the attendees you pick.
- Recurring sessions, reminders in-app, attendance recorded (joined / no-show), and the
  session can count toward required weekly hours.

**Accountability rules**
- Require X hours of training per week (or per month), configurable per role.
- Required courses with due dates; overdue shows red for the rep and on the admin board.
- Weekly digest to admins: who hit their hours, who didn't.

**Scoreboard**
- Team ranking by points: lessons completed, quiz scores, watch time, live attendance,
  streaks. Weekly / monthly / all-time toggle, plus per-course leaderboards.
- Badges for streaks and course completions.

**Admin tracking panel**
- Per-person view: last login, minutes watched this week vs. required, courses assigned
  / in progress / completed, quiz scores, checkpoint answers they got wrong, live
  attendance, and an activity timeline.
- Per-course view: enrollment, completion rate, average score, the questions most people
  fail (so you can fix the lesson).
- Export to CSV.

## What a rep sees

A "Company Training" tile on the Claim Buddy dashboard, next to Survival Guide. Inside:
"Assigned to you" with due dates and a weekly hours ring, the course catalog, continue-
where-you-left-off, the scoreboard, and upcoming live calls. Lessons work one-handed on
a phone, and text/quiz lessons keep working with a weak signal.

## Technical notes

- New tables (all `workspace_id` scoped, RLS via existing `cb_is_admin` / membership
  helpers): `cb_courses`, `cb_modules`, `cb_lessons`, `cb_lesson_assets`,
  `cb_video_checkpoints` (timestamp, question, options, branch target),
  `cb_quizzes`, `cb_quiz_questions`, `cb_quiz_attempts`, `cb_assignments`,
  `cb_progress` (per lesson: watched ranges jsonb, percent, completed_at),
  `cb_training_events` (login/activity timeline), `cb_live_sessions`,
  `cb_live_attendance`, `cb_training_rules` (required hours per role),
  `cb_training_points` + `cb_training_badges`. Grants + policies in the same migration.
- Private storage bucket `cb-training` for uploaded videos, documents and thumbnails,
  with workspace-prefixed paths and signed-URL reads.
- Watch tracking posts merged second-ranges from the player, so completion percentage
  can't be faked by seeking; server recomputes percent on write.
- AI (course outline, quiz generation, tutor, free-text grading) runs through Lovable AI
  in `createServerFn` handlers — `src/lib/cbTraining.functions.ts`. Transcripts come from
  the uploaded caption file or a speech-to-text pass on upload.
- Google Meet uses a Google Calendar connection stored per workspace; session create /
  update / cancel goes through a server function that calls Calendar with
  `conferenceData` to mint the Meet link. If the company hasn't connected Google yet, the
  session falls back to a manually pasted link.
- Routes: `/cb/training` (catalog + assigned), `/cb/training/course/$id`,
  `/cb/training/lesson/$id`, `/cb/training/scoreboard`, `/cb/training/live`, and admin
  side `/cb/admin/training` with Courses / Live / Rules / People / Reports tabs. Super
  admin gets a read-only roll-up in the existing Claim Buddy admin tab.
- Everything reuses the Claim Buddy design system (`CbSurface`, `CbCard`, `CbButton`,
  `CbReveal`) — no new visual language.
- No feature flag gate: available to every tier. The Survival Guide gate is untouched.

## Build order

1. Schema + storage + RLS.
2. Course builder and rep course/lesson player with progress tracking.
3. Interactive video checkpoints and branching.
4. Quizzes + AI generation, AI tutor, AI grading.
5. Live sessions with Google Meet.
6. Rules, scoreboard, badges.
7. Admin tracking panel, digests and CSV export.
