ALTER TABLE public.cb_site_media ADD COLUMN IF NOT EXISTS media_key text;

UPDATE public.cb_site_media m
SET media_key = d.k
FROM (
  SELECT id,
         regexp_replace(
           lower(regexp_replace(regexp_replace(split_part(storage_path, '/', array_length(string_to_array(storage_path,'/'),1)), '\.[^.]+$', ''), '^[0-9]{10,}[-_]?', '')),
           '[^a-z0-9]', '', 'g'
         ) AS k
  FROM public.cb_site_media
) d
WHERE m.id = d.id AND m.media_key IS NULL;

UPDATE public.cb_site_media m
SET media_key = coalesce(nullif(m.media_key, ''), 'media') || '-' || substr(m.id::text, 1, 8)
WHERE m.media_key IS NULL
   OR m.media_key = ''
   OR EXISTS (
     SELECT 1 FROM public.cb_site_media o
     WHERE o.media_key = m.media_key AND o.id <> m.id AND o.created_at < m.created_at
   );

ALTER TABLE public.cb_site_media ALTER COLUMN media_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cb_site_media_media_key_key ON public.cb_site_media (media_key);

DROP TRIGGER IF EXISTS cb_site_blocks_touch ON public.cb_site_blocks;
CREATE TRIGGER cb_site_blocks_touch BEFORE UPDATE ON public.cb_site_blocks
  FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();

DROP TRIGGER IF EXISTS cb_site_media_touch ON public.cb_site_media;
CREATE TRIGGER cb_site_media_touch BEFORE UPDATE ON public.cb_site_media
  FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();

DROP TRIGGER IF EXISTS cb_site_faq_touch ON public.cb_site_faq;
CREATE TRIGGER cb_site_faq_touch BEFORE UPDATE ON public.cb_site_faq
  FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();

DROP TRIGGER IF EXISTS cb_site_videos_touch ON public.cb_site_videos;
CREATE TRIGGER cb_site_videos_touch BEFORE UPDATE ON public.cb_site_videos
  FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();

DROP TRIGGER IF EXISTS cb_blog_posts_touch ON public.cb_blog_posts;
CREATE TRIGGER cb_blog_posts_touch BEFORE UPDATE ON public.cb_blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();