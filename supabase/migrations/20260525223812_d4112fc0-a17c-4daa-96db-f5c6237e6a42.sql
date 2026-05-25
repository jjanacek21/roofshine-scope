
-- door_knocks: rename to match components
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='door_knocks' AND column_name='latitude') THEN
    ALTER TABLE public.door_knocks RENAME COLUMN latitude TO lat;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='door_knocks' AND column_name='longitude') THEN
    ALTER TABLE public.door_knocks RENAME COLUMN longitude TO lng;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='door_knocks' AND column_name='dwell_seconds') THEN
    ALTER TABLE public.door_knocks RENAME COLUMN dwell_seconds TO dwell_time_seconds;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='door_knocks' AND column_name='points_earned') THEN
    ALTER TABLE public.door_knocks RENAME COLUMN points_earned TO points_awarded;
  END IF;
END$$;

UPDATE public.door_knocks SET dwell_time_seconds = 0 WHERE dwell_time_seconds IS NULL;
UPDATE public.door_knocks SET points_awarded = 0 WHERE points_awarded IS NULL;
UPDATE public.door_knocks SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE public.door_knocks
  ALTER COLUMN dwell_time_seconds SET DEFAULT 0,
  ALTER COLUMN dwell_time_seconds SET NOT NULL,
  ALTER COLUMN points_awarded SET DEFAULT 0,
  ALTER COLUMN points_awarded SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

-- field_sessions: route_geometry -> route_geojson, NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='field_sessions' AND column_name='route_geometry')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='field_sessions' AND column_name='route_geojson') THEN
    ALTER TABLE public.field_sessions RENAME COLUMN route_geometry TO route_geojson;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='field_sessions' AND column_name='route_geojson') THEN
    ALTER TABLE public.field_sessions ADD COLUMN route_geojson JSONB;
  END IF;
END$$;

UPDATE public.field_sessions SET route_geojson = '{"type":"LineString","coordinates":[]}'::jsonb WHERE route_geojson IS NULL;
ALTER TABLE public.field_sessions
  ALTER COLUMN route_geojson SET DEFAULT '{"type":"LineString","coordinates":[]}'::jsonb,
  ALTER COLUMN route_geojson SET NOT NULL;

-- door_to_door_stats: rename + add + tighten
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='door_to_door_stats' AND column_name='total_doors_knocked')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='door_to_door_stats' AND column_name='total_doors') THEN
    ALTER TABLE public.door_to_door_stats RENAME COLUMN total_doors_knocked TO total_doors;
  END IF;
END$$;

ALTER TABLE public.door_to_door_stats
  ADD COLUMN IF NOT EXISTS total_doors INT,
  ADD COLUMN IF NOT EXISTS total_points INT,
  ADD COLUMN IF NOT EXISTS total_verifications INT;

UPDATE public.door_to_door_stats SET
  total_sessions = COALESCE(total_sessions, 0),
  total_doors = COALESCE(total_doors, 0),
  total_points = COALESCE(total_points, 0),
  total_appointments = COALESCE(total_appointments, 0),
  total_contracts = COALESCE(total_contracts, 0),
  total_verifications = COALESCE(total_verifications, 0),
  current_streak_days = COALESCE(current_streak_days, 0),
  longest_streak_days = COALESCE(longest_streak_days, 0);

ALTER TABLE public.door_to_door_stats
  ALTER COLUMN total_sessions SET DEFAULT 0, ALTER COLUMN total_sessions SET NOT NULL,
  ALTER COLUMN total_doors SET DEFAULT 0, ALTER COLUMN total_doors SET NOT NULL,
  ALTER COLUMN total_points SET DEFAULT 0, ALTER COLUMN total_points SET NOT NULL,
  ALTER COLUMN total_appointments SET DEFAULT 0, ALTER COLUMN total_appointments SET NOT NULL,
  ALTER COLUMN total_contracts SET DEFAULT 0, ALTER COLUMN total_contracts SET NOT NULL,
  ALTER COLUMN total_verifications SET DEFAULT 0, ALTER COLUMN total_verifications SET NOT NULL,
  ALTER COLUMN current_streak_days SET DEFAULT 0, ALTER COLUMN current_streak_days SET NOT NULL,
  ALTER COLUMN longest_streak_days SET DEFAULT 0, ALTER COLUMN longest_streak_days SET NOT NULL;

-- video_verifications: add duration + points
ALTER TABLE public.video_verifications
  ADD COLUMN IF NOT EXISTS duration_seconds INT,
  ADD COLUMN IF NOT EXISTS points_awarded INT;

-- user_locations: rename to lat/lng
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_locations' AND column_name='latitude')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_locations' AND column_name='lat') THEN
    ALTER TABLE public.user_locations RENAME COLUMN latitude TO lat;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_locations' AND column_name='longitude')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_locations' AND column_name='lng') THEN
    ALTER TABLE public.user_locations RENAME COLUMN longitude TO lng;
  END IF;
END$$;

-- storm_events table
CREATE TABLE IF NOT EXISTS public.storm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  storm_date DATE NOT NULL,
  affected_area TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'moderate',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.storm_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "storm events readable by authenticated" ON public.storm_events;
CREATE POLICY "storm events readable by authenticated" ON public.storm_events
  FOR SELECT TO authenticated USING (true);
