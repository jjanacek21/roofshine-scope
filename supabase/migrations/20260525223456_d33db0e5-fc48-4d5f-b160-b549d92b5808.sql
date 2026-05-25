
-- a) parent_id for threaded comments
ALTER TABLE public.session_feed_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.session_feed_comments(id) ON DELETE CASCADE;

-- b) reaction -> reaction_type, with unique constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='session_feed_reactions' AND column_name='reaction') THEN
    ALTER TABLE public.session_feed_reactions RENAME COLUMN reaction TO reaction_type;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='session_feed_reactions' AND column_name='reaction_type') THEN
    ALTER TABLE public.session_feed_reactions ADD COLUMN reaction_type TEXT NOT NULL DEFAULT 'like';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_feed_reactions_post_user_type_key'
  ) THEN
    ALTER TABLE public.session_feed_reactions
      ADD CONSTRAINT session_feed_reactions_post_user_type_key UNIQUE (post_id, user_id, reaction_type);
  END IF;
END$$;

-- c) feed posts extra columns
ALTER TABLE public.session_feed_posts
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS video_type TEXT,
  ADD COLUMN IF NOT EXISTS points_earned INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doors_knocked INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads_gotten INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goals_doors INT,
  ADD COLUMN IF NOT EXISTS goals_leads INT;

-- d) rename property_notes column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='property_notes' AND column_name='property_disposition_id') THEN
    ALTER TABLE public.property_notes RENAME COLUMN property_disposition_id TO property_id;
  END IF;
END$$;

-- e) company_members
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'rep',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, user_id)
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members view own membership" ON public.company_members;
CREATE POLICY "members view own membership" ON public.company_members FOR SELECT USING (auth.uid() = user_id);

-- f) property_photos
CREATE TABLE IF NOT EXISTS public.property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.property_dispositions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own property photos" ON public.property_photos;
CREATE POLICY "users manage own property photos" ON public.property_photos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- g) property_residents
CREATE TABLE IF NOT EXISTS public.property_residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.property_dispositions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.property_residents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own property residents" ON public.property_residents;
CREATE POLICY "users manage own property residents" ON public.property_residents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- h) property-photos storage bucket (PUBLIC)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Property photos public read" ON storage.objects;
CREATE POLICY "Property photos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "Property photos owner insert" ON storage.objects;
CREATE POLICY "Property photos owner insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Property photos owner update" ON storage.objects;
CREATE POLICY "Property photos owner update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Property photos owner delete" ON storage.objects;
CREATE POLICY "Property photos owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
