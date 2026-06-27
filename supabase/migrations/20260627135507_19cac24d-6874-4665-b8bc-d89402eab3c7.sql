
-- material_suppliers: ensure no anon read; restrict to tenant authenticated users
DROP POLICY IF EXISTS "view suppliers" ON public.material_suppliers;
DROP POLICY IF EXISTS "admin manage suppliers" ON public.material_suppliers;
CREATE POLICY "view suppliers" ON public.material_suppliers
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.auth_company_id());
CREATE POLICY "admin manage suppliers" ON public.material_suppliers
  FOR ALL TO authenticated
  USING (company_id = public.auth_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.auth_company_id() AND public.is_company_admin());

-- session_feed_posts
DROP POLICY IF EXISTS "view all feed posts" ON public.session_feed_posts;
CREATE POLICY "view all feed posts" ON public.session_feed_posts
  FOR SELECT TO authenticated USING (true);

-- session_feed_comments
DROP POLICY IF EXISTS "view all comments" ON public.session_feed_comments;
CREATE POLICY "view all comments" ON public.session_feed_comments
  FOR SELECT TO authenticated USING (true);

-- session_feed_reactions
DROP POLICY IF EXISTS "view all reactions" ON public.session_feed_reactions;
CREATE POLICY "view all reactions" ON public.session_feed_reactions
  FOR SELECT TO authenticated USING (true);

-- user_gamification
DROP POLICY IF EXISTS "anyone view gamification for leaderboard" ON public.user_gamification;
CREATE POLICY "view gamification leaderboard" ON public.user_gamification
  FOR SELECT TO authenticated USING (true);
