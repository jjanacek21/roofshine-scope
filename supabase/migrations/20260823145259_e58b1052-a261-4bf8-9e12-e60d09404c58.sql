DROP POLICY IF EXISTS "feed_post_comments: read if post readable" ON public.feed_post_comments;
CREATE POLICY "feed_post_comments: read if post readable"
ON public.feed_post_comments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.feed_posts p
  WHERE p.id = feed_post_comments.post_id
    AND (
      p.visibility = 'global'
      OR p.author_id = auth.uid()
      OR (p.visibility = 'team' AND p.company_id IS NOT NULL AND p.company_id = auth_company_id())
      OR (p.visibility = 'friends' AND are_friends(p.author_id, auth.uid()))
    )
));

ALTER FUNCTION public.swath_geojson(date, text) SET search_path = public;
ALTER FUNCTION public.wind_geojson(integer) SET search_path = public;
ALTER FUNCTION public.territories_geojson() SET search_path = public;
ALTER FUNCTION public.generate_storm_swaths(date, text, double precision) SET search_path = public;
ALTER FUNCTION public.swath_dates() SET search_path = public;

REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;