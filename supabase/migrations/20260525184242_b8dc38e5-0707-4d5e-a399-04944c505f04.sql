
-- Drop existing empty D2D tables to recreate with source schema
DROP TABLE IF EXISTS public.session_progress_videos CASCADE;
DROP TABLE IF EXISTS public.session_feed_reactions CASCADE;
DROP TABLE IF EXISTS public.session_feed_comments CASCADE;
DROP TABLE IF EXISTS public.session_feed_posts CASCADE;
DROP TABLE IF EXISTS public.door_to_door_stats CASCADE;
DROP TABLE IF EXISTS public.door_session_goals CASCADE;
DROP TABLE IF EXISTS public.door_knocks CASCADE;
DROP TABLE IF EXISTS public.property_dispositions CASCADE;
DROP TABLE IF EXISTS public.field_sessions CASCADE;

-- Drop d2d-related triggers/functions that referenced old columns
DROP FUNCTION IF EXISTS public.update_door_to_door_stats() CASCADE;
DROP FUNCTION IF EXISTS public.update_stats_on_session_start() CASCADE;
DROP FUNCTION IF EXISTS public.update_session_totals() CASCADE;
DROP FUNCTION IF EXISTS public.stamp_d2d_company_id() CASCADE;

-- Drop and recreate enums
DROP TYPE IF EXISTS public.door_to_door_disposition CASCADE;
DROP TYPE IF EXISTS public.door_disposition CASCADE;
DROP TYPE IF EXISTS public.property_status CASCADE;

CREATE TYPE public.door_disposition AS ENUM (
  'not_home','not_interested','go_back','interested',
  'needs_inspection','appointment_set','contract_signed'
);

CREATE TYPE public.property_status AS ENUM (
  'not_contacted','contacted','interested','not_interested',
  'appointment','customer','do_not_knock'
);

-- ===========================================================
-- D2D CORE TABLES (source schema)
-- ===========================================================
CREATE TABLE public.field_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  total_doors_knocked INT DEFAULT 0,
  total_points_earned INT DEFAULT 0,
  total_distance_meters NUMERIC DEFAULT 0,
  route_geometry JSONB,
  start_location JSONB,
  end_location JSONB,
  pre_session_video_url TEXT,
  pre_session_goal TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.field_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own sessions" ON public.field_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.door_knocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.field_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID,
  address TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  disposition public.door_disposition NOT NULL,
  points_earned INT DEFAULT 0,
  customer_name TEXT, customer_phone TEXT, customer_email TEXT,
  appointment_date TIMESTAMPTZ,
  notes TEXT,
  dwell_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.door_knocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own knocks" ON public.door_knocks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.property_dispositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  latitude NUMERIC, longitude NUMERIC,
  status public.property_status DEFAULT 'not_contacted',
  current_disposition public.door_disposition,
  customer_name TEXT, customer_phone TEXT, customer_email TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  total_knocks INT DEFAULT 0,
  last_knocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, address)
);
ALTER TABLE public.property_dispositions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own dispositions" ON public.property_dispositions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_property_dispositions_updated BEFORE UPDATE
  ON public.property_dispositions FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.door_session_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.field_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL,
  target_value INT NOT NULL,
  current_value INT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.door_session_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own goals" ON public.door_session_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.door_to_door_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sessions INT DEFAULT 0,
  total_doors_knocked INT DEFAULT 0,
  total_points INT DEFAULT 0,
  total_appointments INT DEFAULT 0,
  total_contracts INT DEFAULT 0,
  current_streak_days INT DEFAULT 0,
  longest_streak_days INT DEFAULT 0,
  last_session_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.door_to_door_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own stats" ON public.door_to_door_stats
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own stats" ON public.door_to_door_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own stats" ON public.door_to_door_stats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.session_feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.field_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  media_urls TEXT[] DEFAULT '{}',
  post_type TEXT DEFAULT 'update',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.session_feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view all feed posts" ON public.session_feed_posts FOR SELECT USING (true);
CREATE POLICY "users create own posts" ON public.session_feed_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own posts" ON public.session_feed_posts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own posts" ON public.session_feed_posts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.session_feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.session_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.session_feed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view all comments" ON public.session_feed_comments FOR SELECT USING (true);
CREATE POLICY "users create own comments" ON public.session_feed_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own comments" ON public.session_feed_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.session_feed_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.session_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id, reaction)
);
ALTER TABLE public.session_feed_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view all reactions" ON public.session_feed_reactions FOR SELECT USING (true);
CREATE POLICY "users manage own reactions" ON public.session_feed_reactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.session_progress_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.field_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT,
  doors_at_recording INT DEFAULT 0,
  points_at_recording INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.session_progress_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own progress videos" ON public.session_progress_videos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===========================================================
-- DEPENDENCY TABLES
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.property_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_disposition_id UUID NOT NULL REFERENCES public.property_dispositions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own notes" ON public.property_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.video_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.field_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  verification_type TEXT NOT NULL DEFAULT 'session_start',
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.video_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own verifications" ON public.video_verifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.field_sessions(id) ON DELETE CASCADE,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own locations" ON public.user_locations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  question TEXT,
  answer TEXT,
  feedback TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own training sessions" ON public.ai_training_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own training sessions" ON public.ai_training_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===========================================================
-- GAMIFICATION TABLES
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.user_gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INT DEFAULT 0,
  available_points INT DEFAULT 0,
  current_level TEXT DEFAULT 'new_contractor'
    CHECK (current_level IN ('new_contractor','rising_star','network_pro','master_referrer','legend')),
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  daily_streak INT DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  last_streak_action_at TIMESTAMPTZ,
  monthly_points INT DEFAULT 0,
  monthly_referrals INT DEFAULT 0,
  total_referrals INT DEFAULT 0,
  successful_referrals INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view gamification for leaderboard" ON public.user_gamification
  FOR SELECT USING (true);
CREATE POLICY "users update own gamification" ON public.user_gamification
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users insert own gamification" ON public.user_gamification
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  category TEXT NOT NULL,
  tier TEXT DEFAULT 'bronze',
  criteria_type TEXT NOT NULL,
  criteria_value INT DEFAULT 0,
  points_awarded INT DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view badges" ON public.badges FOR SELECT USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  displayed BOOLEAN DEFAULT true,
  notified BOOLEAN DEFAULT false,
  UNIQUE (user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view user badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "system inserts user badges" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN ('individual','team','company')),
  target_metric TEXT NOT NULL CHECK (target_metric IN ('referrals','conversions','photos','verifications','logins','points')),
  target_value INT NOT NULL,
  points_reward INT DEFAULT 0,
  badge_reward_id UUID REFERENCES public.badges(id),
  bonus_payout_percent NUMERIC(5,2) DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view active challenges" ON public.challenges
  FOR SELECT USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress INT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  reward_claimed BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users join challenges" ON public.challenge_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users view own participation" ON public.challenge_participants
  FOR SELECT USING (true);
CREATE POLICY "users update own progress" ON public.challenge_participants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.rewards_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  points_cost INT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('visibility_boost','bonus_payout','premium_feature','merch','marketing_credit','priority_support')),
  reward_value TEXT,
  quantity_available INT,
  is_available BOOLEAN DEFAULT true,
  valid_days INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view available rewards" ON public.rewards_catalog
  FOR SELECT USING (is_available = true);

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards_catalog(id) ON DELETE CASCADE,
  points_spent INT NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','used','expired','cancelled'))
);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users redeem rewards" ON public.reward_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users view own redemptions" ON public.reward_redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- ===========================================================
-- STORAGE POLICIES (buckets already exist)
-- ===========================================================
DROP POLICY IF EXISTS "users read own d2d videos" ON storage.objects;
DROP POLICY IF EXISTS "users upload own d2d videos" ON storage.objects;
DROP POLICY IF EXISTS "users delete own d2d videos" ON storage.objects;
DROP POLICY IF EXISTS "anyone read feed media" ON storage.objects;
DROP POLICY IF EXISTS "users upload own feed media" ON storage.objects;
DROP POLICY IF EXISTS "users delete own feed media" ON storage.objects;

CREATE POLICY "users read own d2d videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'door-to-door-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users upload own d2d videos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'door-to-door-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own d2d videos" ON storage.objects FOR DELETE
  USING (bucket_id = 'door-to-door-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "anyone read feed media" ON storage.objects FOR SELECT
  USING (bucket_id = 'feed-media');
CREATE POLICY "users upload own feed media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feed-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own feed media" ON storage.objects FOR DELETE
  USING (bucket_id = 'feed-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Make feed-media public
UPDATE storage.buckets SET public = true WHERE id = 'feed-media';
