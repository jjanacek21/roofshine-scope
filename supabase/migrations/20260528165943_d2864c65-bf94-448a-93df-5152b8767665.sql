
-- =========================================================
-- Part 1: property_dispositions additions
-- =========================================================
ALTER TABLE public.property_dispositions
  ADD COLUMN IF NOT EXISTS measurement jsonb,
  ADD COLUMN IF NOT EXISTS selected_system_type text,
  ADD COLUMN IF NOT EXISTS selected_tier text,
  ADD COLUMN IF NOT EXISTS selected_quote jsonb;

ALTER TABLE public.property_dispositions
  DROP CONSTRAINT IF EXISTS property_dispositions_system_type_check;
ALTER TABLE public.property_dispositions
  ADD CONSTRAINT property_dispositions_system_type_check
    CHECK (selected_system_type IS NULL OR selected_system_type IN ('shingle','tile','metal','flat'));

ALTER TABLE public.property_dispositions
  DROP CONSTRAINT IF EXISTS property_dispositions_tier_check;
ALTER TABLE public.property_dispositions
  ADD CONSTRAINT property_dispositions_tier_check
    CHECK (selected_tier IS NULL OR selected_tier IN ('good','better','best'));

-- =========================================================
-- Part 2: friendships
-- =========================================================
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships: read own"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships: insert as requester"
  ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "friendships: update own side"
  ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships: delete own side"
  ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Helper function: are two users accepted friends?
CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = _a AND addressee_id = _b)
        OR (requester_id = _b AND addressee_id = _a))
  );
$$;

-- =========================================================
-- Part 3: feed_posts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'global' CHECK (visibility IN ('global','friends','team')),
  company_id uuid,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON public.feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_author ON public.feed_posts(author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_posts: read by visibility"
  ON public.feed_posts FOR SELECT TO authenticated
  USING (
    visibility = 'global'
    OR author_id = auth.uid()
    OR (visibility = 'team' AND company_id IS NOT NULL AND company_id = public.auth_company_id())
    OR (visibility = 'friends' AND public.are_friends(author_id, auth.uid()))
  );

CREATE POLICY "feed_posts: insert as author"
  ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "feed_posts: update own"
  ON public.feed_posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

CREATE POLICY "feed_posts: delete own"
  ON public.feed_posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE TRIGGER feed_posts_updated
  BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Part 4: feed_post_likes
-- =========================================================
CREATE TABLE IF NOT EXISTS public.feed_post_likes (
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.feed_post_likes TO authenticated;
GRANT ALL ON public.feed_post_likes TO service_role;

ALTER TABLE public.feed_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_post_likes: read all"
  ON public.feed_post_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "feed_post_likes: insert own"
  ON public.feed_post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feed_post_likes: delete own"
  ON public.feed_post_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_feed_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_feed_post_likes_count ON public.feed_post_likes;
CREATE TRIGGER trg_feed_post_likes_count
  AFTER INSERT OR DELETE ON public.feed_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_feed_like_count();

-- =========================================================
-- Part 5: feed_post_comments
-- =========================================================
CREATE TABLE IF NOT EXISTS public.feed_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON public.feed_post_comments(post_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_post_comments TO authenticated;
GRANT ALL ON public.feed_post_comments TO service_role;

ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed_post_comments: read if post readable"
  ON public.feed_post_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id));

CREATE POLICY "feed_post_comments: insert as author"
  ON public.feed_post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "feed_post_comments: delete own"
  ON public.feed_post_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.bump_feed_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_feed_comments_count ON public.feed_post_comments;
CREATE TRIGGER trg_feed_comments_count
  AFTER INSERT OR DELETE ON public.feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_feed_comment_count();

-- =========================================================
-- Part 6: d2d_chat_messages
-- =========================================================
CREATE TABLE IF NOT EXISTS public.d2d_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','team')),
  company_id uuid,
  session_id uuid,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_d2d_chat_scope_created ON public.d2d_chat_messages(scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_d2d_chat_company_created ON public.d2d_chat_messages(company_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.d2d_chat_messages TO authenticated;
GRANT ALL ON public.d2d_chat_messages TO service_role;

ALTER TABLE public.d2d_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "d2d_chat: read by scope"
  ON public.d2d_chat_messages FOR SELECT TO authenticated
  USING (
    scope = 'global'
    OR (scope = 'team' AND company_id IS NOT NULL AND company_id = public.auth_company_id())
  );

CREATE POLICY "d2d_chat: insert as author"
  ON public.d2d_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "d2d_chat: delete own"
  ON public.d2d_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- =========================================================
-- Part 7: user_rewards
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid,
  reward_name text NOT NULL,
  points_spent integer NOT NULL DEFAULT 0,
  earned_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON public.user_rewards(user_id, earned_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_rewards TO authenticated;
GRANT ALL ON public.user_rewards TO service_role;

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_rewards: read own"
  ON public.user_rewards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_rewards: insert own"
  ON public.user_rewards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_rewards: update own"
  ON public.user_rewards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- Part 8: avatars bucket
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar images public read" ON storage.objects;
CREATE POLICY "Avatar images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================================
-- Part 9: realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.d2d_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
