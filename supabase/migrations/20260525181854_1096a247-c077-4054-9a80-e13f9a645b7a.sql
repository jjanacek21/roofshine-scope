
-- ============ ENUM ============
DO $$ BEGIN
  CREATE TYPE public.door_to_door_disposition AS ENUM (
    'not_home', 'not_interested', 'go_back', 'interested',
    'needs_inspection', 'appointment_set', 'contract_signed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ field_sessions ============
CREATE TABLE public.field_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_doors integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  route_geojson jsonb,
  is_active boolean NOT NULL DEFAULT true,
  status text DEFAULT 'active',
  goals_doors integer DEFAULT 0,
  goals_leads integer DEFAULT 0,
  storm_event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_field_sessions_company ON public.field_sessions(company_id);
CREATE INDEX idx_field_sessions_user ON public.field_sessions(user_id);
CREATE INDEX idx_field_sessions_is_active ON public.field_sessions(is_active);
ALTER TABLE public.field_sessions ENABLE ROW LEVEL SECURITY;

-- ============ door_knocks ============
CREATE TABLE public.door_knocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  address text,
  disposition door_to_door_disposition NOT NULL,
  dwell_time_seconds integer NOT NULL DEFAULT 0,
  customer_name text,
  customer_phone text,
  customer_email text,
  appointment_date timestamptz,
  points_awarded integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_door_knocks_company ON public.door_knocks(company_id);
CREATE INDEX idx_door_knocks_session ON public.door_knocks(session_id);
CREATE INDEX idx_door_knocks_user ON public.door_knocks(user_id);
ALTER TABLE public.door_knocks ENABLE ROW LEVEL SECURITY;

-- ============ property_dispositions ============
CREATE TABLE public.property_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  lat_lng_hash text NOT NULL,
  address text,
  disposition text NOT NULL DEFAULT 'not_contacted'
    CHECK (disposition IN ('not_contacted','not_home','not_interested','go_back','interested','needs_inspection','appointment_set','contract_signed')),
  customer_name text,
  customer_phone text,
  customer_email text,
  notes text,
  roof_type text,
  roof_condition text,
  insurance_claim boolean DEFAULT false,
  storm_date date,
  priority text DEFAULT 'normal',
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_property_dispositions_user_hash ON public.property_dispositions(user_id, lat_lng_hash);
CREATE INDEX idx_property_dispositions_company ON public.property_dispositions(company_id);
CREATE INDEX idx_property_dispositions_bounds ON public.property_dispositions(company_id, lat, lng);
ALTER TABLE public.property_dispositions ENABLE ROW LEVEL SECURITY;

-- ============ door_session_goals ============
CREATE TABLE public.door_session_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  goals_doors integer NOT NULL DEFAULT 50,
  goals_leads integer NOT NULL DEFAULT 5,
  video_url text NOT NULL,
  video_duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_door_session_goals_company ON public.door_session_goals(company_id);
CREATE INDEX idx_door_session_goals_session ON public.door_session_goals(session_id);
CREATE INDEX idx_door_session_goals_user ON public.door_session_goals(user_id);
ALTER TABLE public.door_session_goals ENABLE ROW LEVEL SECURITY;

-- ============ door_to_door_stats ============
CREATE TABLE public.door_to_door_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  total_sessions integer NOT NULL DEFAULT 0,
  total_doors integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  total_appointments integer NOT NULL DEFAULT 0,
  total_contracts integer NOT NULL DEFAULT 0,
  total_verifications integer NOT NULL DEFAULT 0,
  current_streak_days integer NOT NULL DEFAULT 0,
  longest_streak_days integer NOT NULL DEFAULT 0,
  last_active_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_d2d_stats_company ON public.door_to_door_stats(company_id);
ALTER TABLE public.door_to_door_stats ENABLE ROW LEVEL SECURITY;

-- ============ session_feed_posts ============
CREATE TABLE public.session_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  video_url text,
  image_url text,
  post_type text DEFAULT 'video' CHECK (post_type IN ('text','photo','video')),
  video_type text NOT NULL DEFAULT 'progress' CHECK (video_type IN ('goal','progress','roof','homeowner')),
  content text,
  points_earned integer NOT NULL DEFAULT 0,
  doors_knocked integer NOT NULL DEFAULT 0,
  leads_gotten integer NOT NULL DEFAULT 0,
  goals_doors integer,
  goals_leads integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_posts_company_created ON public.session_feed_posts(company_id, created_at DESC);
CREATE INDEX idx_feed_posts_user ON public.session_feed_posts(user_id);
ALTER TABLE public.session_feed_posts ENABLE ROW LEVEL SECURITY;

-- ============ session_feed_comments ============
CREATE TABLE public.session_feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_comments_post ON public.session_feed_comments(post_id);
CREATE INDEX idx_feed_comments_parent ON public.session_feed_comments(parent_id);
CREATE INDEX idx_feed_comments_company ON public.session_feed_comments(company_id);
ALTER TABLE public.session_feed_comments ENABLE ROW LEVEL SECURITY;

-- ============ session_feed_reactions ============
CREATE TABLE public.session_feed_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction_type text NOT NULL DEFAULT '👏'
    CHECK (reaction_type IN ('👏','🔥','💪','🎯','⭐','🚀')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction_type)
);
CREATE INDEX idx_feed_reactions_post ON public.session_feed_reactions(post_id);
CREATE INDEX idx_feed_reactions_company ON public.session_feed_reactions(company_id);
ALTER TABLE public.session_feed_reactions ENABLE ROW LEVEL SECURITY;

-- ============ session_progress_videos ============
CREATE TABLE public.session_progress_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  video_url text NOT NULL,
  video_duration_seconds integer NOT NULL DEFAULT 0,
  update_number integer NOT NULL DEFAULT 1,
  video_type text NOT NULL DEFAULT 'progress' CHECK (video_type IN ('goal','progress','roof','homeowner')),
  points_multiplier numeric NOT NULL DEFAULT 1.0,
  points_awarded integer NOT NULL DEFAULT 100,
  challenges_mentioned text,
  updated_goals_doors integer,
  updated_goals_leads integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_progress_videos_company ON public.session_progress_videos(company_id);
CREATE INDEX idx_progress_videos_session ON public.session_progress_videos(session_id);
CREATE INDEX idx_progress_videos_user ON public.session_progress_videos(user_id);
ALTER TABLE public.session_progress_videos ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGER FUNCTIONS ============

-- Stamp company_id from auth_company_id() if null
CREATE OR REPLACE FUNCTION public.stamp_d2d_company_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.auth_company_id();
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;

-- Aggregated leaderboard stats
CREATE OR REPLACE FUNCTION public.update_door_to_door_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.door_to_door_stats (company_id, user_id, total_doors, total_points, last_active_date)
  VALUES (NEW.company_id, NEW.user_id, 1, NEW.points_awarded, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET
    total_doors = door_to_door_stats.total_doors + 1,
    total_points = door_to_door_stats.total_points + NEW.points_awarded,
    total_appointments = door_to_door_stats.total_appointments
      + CASE WHEN NEW.disposition IN ('appointment_set','contract_signed') THEN 1 ELSE 0 END,
    total_contracts = door_to_door_stats.total_contracts
      + CASE WHEN NEW.disposition = 'contract_signed' THEN 1 ELSE 0 END,
    last_active_date = CURRENT_DATE,
    updated_at = now();
  RETURN NEW;
END $$;

-- Keep field_sessions totals in sync
CREATE OR REPLACE FUNCTION public.update_session_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.field_sessions
  SET total_doors = total_doors + 1,
      total_points = total_points + NEW.points_awarded
  WHERE id = NEW.session_id;
  RETURN NEW;
END $$;

-- Stats on session start
CREATE OR REPLACE FUNCTION public.update_stats_on_session_start()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.door_to_door_stats (company_id, user_id, total_sessions, last_active_date)
  VALUES (NEW.company_id, NEW.user_id, 1, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE SET
    total_sessions = door_to_door_stats.total_sessions + 1,
    last_active_date = CURRENT_DATE,
    updated_at = now();
  RETURN NEW;
END $$;

-- updated_at on property_dispositions
CREATE TRIGGER trg_property_dispositions_updated_at
  BEFORE UPDATE ON public.property_dispositions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_feed_comments_updated_at
  BEFORE UPDATE ON public.session_feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stamp triggers
CREATE TRIGGER trg_stamp_field_sessions BEFORE INSERT ON public.field_sessions FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();
CREATE TRIGGER trg_stamp_door_knocks BEFORE INSERT ON public.door_knocks FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();
CREATE TRIGGER trg_stamp_prop_disp BEFORE INSERT ON public.property_dispositions FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();
CREATE TRIGGER trg_stamp_session_goals BEFORE INSERT ON public.door_session_goals FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();
CREATE TRIGGER trg_stamp_d2d_stats BEFORE INSERT ON public.door_to_door_stats FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();
CREATE TRIGGER trg_stamp_feed_posts BEFORE INSERT ON public.session_feed_posts FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();
CREATE TRIGGER trg_stamp_feed_comments BEFORE INSERT ON public.session_feed_comments FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();
CREATE TRIGGER trg_stamp_feed_reactions BEFORE INSERT ON public.session_feed_reactions FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();
CREATE TRIGGER trg_stamp_progress_videos BEFORE INSERT ON public.session_progress_videos FOR EACH ROW EXECUTE FUNCTION public.stamp_d2d_company_id();

-- Aggregation triggers
CREATE TRIGGER trg_update_d2d_stats AFTER INSERT ON public.door_knocks FOR EACH ROW EXECUTE FUNCTION public.update_door_to_door_stats();
CREATE TRIGGER trg_update_session_totals AFTER INSERT ON public.door_knocks FOR EACH ROW EXECUTE FUNCTION public.update_session_totals();
CREATE TRIGGER trg_update_stats_on_session_start AFTER INSERT ON public.field_sessions FOR EACH ROW EXECUTE FUNCTION public.update_stats_on_session_start();

-- ============ RLS POLICIES ============

-- field_sessions
CREATE POLICY "fs_select" ON public.field_sessions FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "fs_insert" ON public.field_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());
CREATE POLICY "fs_update" ON public.field_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "fs_delete" ON public.field_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- door_knocks
CREATE POLICY "dk_select" ON public.door_knocks FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "dk_insert" ON public.door_knocks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());
CREATE POLICY "dk_update" ON public.door_knocks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "dk_delete" ON public.door_knocks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- property_dispositions
CREATE POLICY "pd_select" ON public.property_dispositions FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "pd_insert" ON public.property_dispositions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());
CREATE POLICY "pd_update" ON public.property_dispositions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "pd_delete" ON public.property_dispositions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- door_session_goals
CREATE POLICY "dsg_select" ON public.door_session_goals FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "dsg_insert" ON public.door_session_goals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());

-- door_to_door_stats
CREATE POLICY "d2ds_select" ON public.door_to_door_stats FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "d2ds_insert" ON public.door_to_door_stats FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());
CREATE POLICY "d2ds_update" ON public.door_to_door_stats FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- session_feed_posts
CREATE POLICY "sfp_select" ON public.session_feed_posts FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "sfp_insert" ON public.session_feed_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());
CREATE POLICY "sfp_update" ON public.session_feed_posts FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_company_admin()) WITH CHECK (user_id = auth.uid() OR public.is_company_admin());
CREATE POLICY "sfp_delete" ON public.session_feed_posts FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_company_admin());

-- session_feed_comments
CREATE POLICY "sfc_select" ON public.session_feed_comments FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "sfc_insert" ON public.session_feed_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());
CREATE POLICY "sfc_update" ON public.session_feed_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sfc_delete" ON public.session_feed_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_company_admin());

-- session_feed_reactions
CREATE POLICY "sfr_select" ON public.session_feed_reactions FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "sfr_insert" ON public.session_feed_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());
CREATE POLICY "sfr_delete" ON public.session_feed_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- session_progress_videos
CREATE POLICY "spv_select" ON public.session_progress_videos FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "spv_insert" ON public.session_progress_videos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND company_id = public.auth_company_id());

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.door_knocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_feed_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_feed_reactions;

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('door-to-door-videos','door-to-door-videos', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('feed-media','feed-media', false) ON CONFLICT DO NOTHING;

-- Storage policies: first folder = company_id
CREATE POLICY "d2d_videos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'door-to-door-videos' AND (storage.foldername(name))[1] = public.auth_company_id()::text);
CREATE POLICY "d2d_videos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'door-to-door-videos' AND (storage.foldername(name))[1] = public.auth_company_id()::text);
CREATE POLICY "d2d_videos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'door-to-door-videos' AND (storage.foldername(name))[1] = public.auth_company_id()::text);

CREATE POLICY "feed_media_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feed-media' AND (storage.foldername(name))[1] = public.auth_company_id()::text);
CREATE POLICY "feed_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed-media' AND (storage.foldername(name))[1] = public.auth_company_id()::text);
CREATE POLICY "feed_media_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed-media' AND (storage.foldername(name))[1] = public.auth_company_id()::text);
