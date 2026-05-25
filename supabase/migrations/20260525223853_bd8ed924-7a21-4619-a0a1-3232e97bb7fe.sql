
-- Extend door_disposition enum with all values used by components
DO $$
DECLARE v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY['need_inspection','storm_damage','unqualified','canvass_lead','new_roof','follow_up','waiting','already_solar','opportunity','commercial','inspected','old_roof','won','not_contacted']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname='door_disposition' AND e.enumlabel=v) THEN
      EXECUTE format('ALTER TYPE public.door_disposition ADD VALUE IF NOT EXISTS %L', v);
    END IF;
  END LOOP;
END$$;

-- property_dispositions: add columns components use
ALTER TABLE public.property_dispositions
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC,
  ADD COLUMN IF NOT EXISTS lat_lng_hash TEXT,
  ADD COLUMN IF NOT EXISTS disposition public.door_disposition,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS roof_type TEXT,
  ADD COLUMN IF NOT EXISTS roof_condition TEXT,
  ADD COLUMN IF NOT EXISTS insurance_claim BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS storm_date DATE,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';

-- Backfill lat/lng from legacy latitude/longitude if present
UPDATE public.property_dispositions
   SET lat = COALESCE(lat, latitude),
       lng = COALESCE(lng, longitude)
 WHERE lat IS NULL OR lng IS NULL;

UPDATE public.property_dispositions
   SET disposition = current_disposition
 WHERE disposition IS NULL AND current_disposition IS NOT NULL;

UPDATE public.property_dispositions
   SET lat_lng_hash = (ROUND(lat::numeric, 5)::text || '_' || ROUND(lng::numeric, 5)::text)
 WHERE lat_lng_hash IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='property_dispositions_user_hash_key') THEN
    ALTER TABLE public.property_dispositions
      ADD CONSTRAINT property_dispositions_user_hash_key UNIQUE (user_id, lat_lng_hash);
  END IF;
END$$;
