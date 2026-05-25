
-- field_sessions: add columns components use
ALTER TABLE public.field_sessions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_doors INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals_doors INT,
  ADD COLUMN IF NOT EXISTS goals_leads INT;

-- session_progress_videos: add expected columns
ALTER TABLE public.session_progress_videos
  ADD COLUMN IF NOT EXISTS video_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS update_number INT,
  ADD COLUMN IF NOT EXISTS video_type TEXT,
  ADD COLUMN IF NOT EXISTS points_multiplier NUMERIC,
  ADD COLUMN IF NOT EXISTS points_awarded INT,
  ADD COLUMN IF NOT EXISTS challenges_mentioned TEXT,
  ADD COLUMN IF NOT EXISTS updated_goals_doors INT,
  ADD COLUMN IF NOT EXISTS updated_goals_leads INT;

-- door_session_goals: add columns; make legacy required cols nullable
ALTER TABLE public.door_session_goals
  ADD COLUMN IF NOT EXISTS goals_doors INT,
  ADD COLUMN IF NOT EXISTS goals_leads INT,
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_duration_seconds INT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='door_session_goals' AND column_name='goal_type' AND is_nullable='NO') THEN
    ALTER TABLE public.door_session_goals ALTER COLUMN goal_type DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='door_session_goals' AND column_name='target_value' AND is_nullable='NO') THEN
    ALTER TABLE public.door_session_goals ALTER COLUMN target_value DROP NOT NULL;
  END IF;
END$$;

-- Tighten nullability so generated types match component interfaces
UPDATE public.property_notes SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE public.property_notes
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

UPDATE public.property_photos SET created_at = now() WHERE created_at IS NULL;
UPDATE public.property_photos SET photo_type = 'general' WHERE photo_type IS NULL;
ALTER TABLE public.property_photos
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN photo_type SET DEFAULT 'general',
  ALTER COLUMN photo_type SET NOT NULL;

UPDATE public.property_residents SET created_at = now() WHERE created_at IS NULL;
UPDATE public.property_residents SET is_primary = false WHERE is_primary IS NULL;
ALTER TABLE public.property_residents
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN is_primary SET DEFAULT false,
  ALTER COLUMN is_primary SET NOT NULL;

UPDATE public.session_feed_comments SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE public.session_feed_comments
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;
