-- ============ COMPANY TRAINING ============

CREATE TABLE public.cb_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  category text,
  status text NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  prerequisite_course_id uuid REFERENCES public.cb_courses(id) ON DELETE SET NULL,
  estimated_minutes integer,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.cb_courses(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.cb_modules(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.cb_courses(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'article',
  body text,
  video_url text,
  video_provider text,
  video_path text,
  duration_seconds integer,
  transcript text,
  document_path text,
  required_percent integer NOT NULL DEFAULT 90,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_video_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.cb_lessons(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  at_seconds integer NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer,
  explanation text,
  branch_seconds integer,
  branch_lesson_id uuid REFERENCES public.cb_lessons(id) ON DELETE SET NULL,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.cb_lessons(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.cb_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  pass_percent integer NOT NULL DEFAULT 80,
  mode text NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.cb_quizzes(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  kind text NOT NULL DEFAULT 'choice',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer,
  model_answer text,
  points integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.cb_quizzes(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  feedback jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_percent numeric,
  passed boolean,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.cb_courses(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'all',
  role text,
  user_id uuid,
  due_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.cb_lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.cb_courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
  watched_seconds integer NOT NULL DEFAULT 0,
  percent numeric NOT NULL DEFAULT 0,
  last_position_seconds integer NOT NULL DEFAULT 0,
  checkpoint_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);

CREATE TABLE public.cb_training_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  course_id uuid REFERENCES public.cb_courses(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES public.cb_lessons(id) ON DELETE SET NULL,
  seconds integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.cb_courses(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  meet_url text,
  google_event_id text,
  recurrence text,
  counts_toward_hours boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_live_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cb_live_sessions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

CREATE TABLE public.cb_training_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'all',
  period text NOT NULL DEFAULT 'week',
  required_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, role)
);

CREATE TABLE public.cb_training_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cb_training_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, code)
);

CREATE TABLE public.cb_google_connections (
  workspace_id uuid PRIMARY KEY REFERENCES public.cb_workspaces(id) ON DELETE CASCADE,
  google_email text,
  refresh_token text,
  access_token text,
  expires_at timestamptz,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_courses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_video_checkpoints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_quiz_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_quiz_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_progress TO authenticated;
GRANT SELECT, INSERT ON public.cb_training_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_live_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_live_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_training_rules TO authenticated;
GRANT SELECT, INSERT ON public.cb_training_points TO authenticated;
GRANT SELECT, INSERT ON public.cb_training_badges TO authenticated;
GRANT SELECT ON public.cb_google_connections TO authenticated;
GRANT ALL ON public.cb_courses, public.cb_modules, public.cb_lessons,
  public.cb_video_checkpoints, public.cb_quizzes, public.cb_quiz_questions,
  public.cb_quiz_attempts, public.cb_assignments, public.cb_progress,
  public.cb_training_events, public.cb_live_sessions, public.cb_live_attendance,
  public.cb_training_rules, public.cb_training_points, public.cb_training_badges,
  public.cb_google_connections TO service_role;

-- ============ RLS ============
ALTER TABLE public.cb_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_video_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_training_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_live_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_training_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_training_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_training_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cb_google_connections ENABLE ROW LEVEL SECURITY;

-- member read / admin write, per table
CREATE POLICY "members read courses" ON public.cb_courses FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write courses" ON public.cb_courses FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "members read modules" ON public.cb_modules FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write modules" ON public.cb_modules FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "members read lessons" ON public.cb_lessons FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write lessons" ON public.cb_lessons FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "members read checkpoints" ON public.cb_video_checkpoints FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write checkpoints" ON public.cb_video_checkpoints FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "members read quizzes" ON public.cb_quizzes FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write quizzes" ON public.cb_quizzes FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "members read quiz questions" ON public.cb_quiz_questions FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write quiz questions" ON public.cb_quiz_questions FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "own attempts" ON public.cb_quiz_attempts FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins read attempts" ON public.cb_quiz_attempts FOR SELECT TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "members read assignments" ON public.cb_assignments FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write assignments" ON public.cb_assignments FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "own progress" ON public.cb_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "team reads progress" ON public.cb_progress FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);

CREATE POLICY "own events insert" ON public.cb_training_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "team reads events" ON public.cb_training_events FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);

CREATE POLICY "members read live" ON public.cb_live_sessions FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write live" ON public.cb_live_sessions FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "members read attendance" ON public.cb_live_attendance FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "own attendance" ON public.cb_live_attendance FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.cb_is_admin(workspace_id))
  WITH CHECK ((user_id = auth.uid() OR public.cb_is_admin(workspace_id))
    AND public.cb_role(workspace_id) IS NOT NULL);

CREATE POLICY "members read rules" ON public.cb_training_rules FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "admins write rules" ON public.cb_training_rules FOR ALL TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin())
  WITH CHECK (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

CREATE POLICY "team reads points" ON public.cb_training_points FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "own points insert" ON public.cb_training_points FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.cb_role(workspace_id) IS NOT NULL);

CREATE POLICY "team reads badges" ON public.cb_training_badges FOR SELECT TO authenticated
  USING (public.cb_role(workspace_id) IS NOT NULL);
CREATE POLICY "own badges insert" ON public.cb_training_badges FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.cb_role(workspace_id) IS NOT NULL);

-- tokens are never readable from the client; only the presence row matters
CREATE POLICY "admins read google connection" ON public.cb_google_connections FOR SELECT TO authenticated
  USING (public.cb_is_admin(workspace_id) OR public.cb_is_super_admin());

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.cb_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_cb_courses_touch BEFORE UPDATE ON public.cb_courses FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_modules_touch BEFORE UPDATE ON public.cb_modules FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_lessons_touch BEFORE UPDATE ON public.cb_lessons FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_checkpoints_touch BEFORE UPDATE ON public.cb_video_checkpoints FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_quizzes_touch BEFORE UPDATE ON public.cb_quizzes FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_quiz_questions_touch BEFORE UPDATE ON public.cb_quiz_questions FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_quiz_attempts_touch BEFORE UPDATE ON public.cb_quiz_attempts FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_assignments_touch BEFORE UPDATE ON public.cb_assignments FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_progress_touch BEFORE UPDATE ON public.cb_progress FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_live_sessions_touch BEFORE UPDATE ON public.cb_live_sessions FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_live_attendance_touch BEFORE UPDATE ON public.cb_live_attendance FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_training_rules_touch BEFORE UPDATE ON public.cb_training_rules FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE TRIGGER t_cb_google_conn_touch BEFORE UPDATE ON public.cb_google_connections FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();

-- ============ INDEXES ============
CREATE INDEX idx_cb_courses_ws ON public.cb_courses(workspace_id);
CREATE INDEX idx_cb_modules_course ON public.cb_modules(course_id);
CREATE INDEX idx_cb_lessons_module ON public.cb_lessons(module_id);
CREATE INDEX idx_cb_lessons_course ON public.cb_lessons(course_id);
CREATE INDEX idx_cb_checkpoints_lesson ON public.cb_video_checkpoints(lesson_id);
CREATE INDEX idx_cb_progress_user ON public.cb_progress(workspace_id, user_id);
CREATE INDEX idx_cb_events_ws_user ON public.cb_training_events(workspace_id, user_id, created_at DESC);
CREATE INDEX idx_cb_points_ws_user ON public.cb_training_points(workspace_id, user_id);
CREATE INDEX idx_cb_live_ws_start ON public.cb_live_sessions(workspace_id, starts_at);
CREATE INDEX idx_cb_attempts_ws_user ON public.cb_quiz_attempts(workspace_id, user_id);