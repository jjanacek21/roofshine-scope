ALTER TABLE public.cb_demo_requests
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS current_tools text,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS features_wanted text[],
  ADD COLUMN IF NOT EXISTS questions text,
  ADD COLUMN IF NOT EXISTS preferred_time text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS cb_demo_requests_status_created_idx
  ON public.cb_demo_requests (status, created_at DESC);