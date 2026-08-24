CREATE TABLE public.cb_site_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cb_site_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_site_blocks TO authenticated;
GRANT ALL ON public.cb_site_blocks TO service_role;
ALTER TABLE public.cb_site_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_site_blocks public read" ON public.cb_site_blocks FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "cb_site_blocks super admin write" ON public.cb_site_blocks FOR ALL TO authenticated USING (public.cb_is_super_admin()) WITH CHECK (public.cb_is_super_admin());
CREATE TRIGGER cb_site_blocks_touch BEFORE UPDATE ON public.cb_site_blocks FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();

CREATE TABLE public.cb_site_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,
  title text NOT NULL,
  caption text,
  category text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cb_site_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_site_media TO authenticated;
GRANT ALL ON public.cb_site_media TO service_role;
ALTER TABLE public.cb_site_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_site_media public read" ON public.cb_site_media FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "cb_site_media super admin write" ON public.cb_site_media FOR ALL TO authenticated USING (public.cb_is_super_admin()) WITH CHECK (public.cb_is_super_admin());
CREATE TRIGGER cb_site_media_touch BEFORE UPDATE ON public.cb_site_media FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE INDEX cb_site_media_category_sort_idx ON public.cb_site_media (category, sort_order);

CREATE TABLE public.cb_site_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cb_site_faq TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_site_faq TO authenticated;
GRANT ALL ON public.cb_site_faq TO service_role;
ALTER TABLE public.cb_site_faq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_site_faq public read" ON public.cb_site_faq FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "cb_site_faq super admin write" ON public.cb_site_faq FOR ALL TO authenticated USING (public.cb_is_super_admin()) WITH CHECK (public.cb_is_super_admin());
CREATE TRIGGER cb_site_faq_touch BEFORE UPDATE ON public.cb_site_faq FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();

CREATE TABLE public.cb_site_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text,
  thumbnail_path text,
  duration_seconds int,
  section text NOT NULL DEFAULT 'training',
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cb_site_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_site_videos TO authenticated;
GRANT ALL ON public.cb_site_videos TO service_role;
ALTER TABLE public.cb_site_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_site_videos public read" ON public.cb_site_videos FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "cb_site_videos super admin write" ON public.cb_site_videos FOR ALL TO authenticated USING (public.cb_is_super_admin()) WITH CHECK (public.cb_is_super_admin());
CREATE TRIGGER cb_site_videos_touch BEFORE UPDATE ON public.cb_site_videos FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();

CREATE TABLE public.cb_blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text,
  body_md text,
  hero_path text,
  keywords text[],
  author text DEFAULT 'Global Contractor Network',
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  generated_by text,
  generation_prompt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cb_blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_blog_posts TO authenticated;
GRANT ALL ON public.cb_blog_posts TO service_role;
ALTER TABLE public.cb_blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_blog_posts public read" ON public.cb_blog_posts FOR SELECT TO anon, authenticated USING (status = 'published' AND published_at <= now());
CREATE POLICY "cb_blog_posts super admin write" ON public.cb_blog_posts FOR ALL TO authenticated USING (public.cb_is_super_admin()) WITH CHECK (public.cb_is_super_admin());
CREATE TRIGGER cb_blog_posts_touch BEFORE UPDATE ON public.cb_blog_posts FOR EACH ROW EXECUTE FUNCTION public.cb_touch_updated_at();
CREATE INDEX cb_blog_posts_status_published_idx ON public.cb_blog_posts (status, published_at DESC);

CREATE POLICY "marketing public read" ON storage.objects FOR SELECT USING (bucket_id = 'marketing');
CREATE POLICY "marketing super admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marketing' AND public.cb_is_super_admin());
CREATE POLICY "marketing super admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'marketing' AND public.cb_is_super_admin()) WITH CHECK (bucket_id = 'marketing' AND public.cb_is_super_admin());
CREATE POLICY "marketing super admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'marketing' AND public.cb_is_super_admin());

INSERT INTO public.cb_site_blocks (key, label, content, sort_order) VALUES
('hero', 'Home — Hero', jsonb_build_object(
  'eyebrow','Insurance restoration · roof, exterior & interior',
  'headline','Measure the roof before you knock on the door.',
  'accent_word','door.',
  'sub','Type an address and the roof traces itself. Then walk it — roof, all four exterior elevations, and the interior — and hand the homeowner a carrier-ready scope before you leave the driveway.',
  'primary_cta', jsonb_build_object('label','Book a demo','href','/cb/signup'),
  'secondary_cta', jsonb_build_object('label','See every screen','href','/#gallery'),
  'stats', jsonb_build_array(
    jsonb_build_object('value','90.4','label','Squares'),
    jsonb_build_object('value','10:12','label','Pitch'),
    jsonb_build_object('value','31','label','Line items')),
  'note','Runs in the phone browser at gcn.claims. No app store, no install.'
), 10),
('measure_player', 'Home — Measurement step player frames', jsonb_build_object(
  'frames', jsonb_build_array(
    jsonb_build_object('src','/marketing/screens/m1_pin.jpg','title','Drop the pin','caption','Type the address, confirm the right house on satellite.'),
    jsonb_build_object('src','/marketing/screens/m2_measuring.jpg','title','Measuring…','caption','The roof traces itself from imagery in a few seconds.'),
    jsonb_build_object('src','/marketing/screens/m3_footprint.jpg','title','One outline per structure','caption','House, garage, shed — each gets its own closed outline.'),
    jsonb_build_object('src','/marketing/screens/m4_drawing.jpg','title','Draw by hand too','caption','Tap point to point when the imagery is behind the times.'),
    jsonb_build_object('src','/marketing/screens/m5_lines.jpg','title','Ridges, hips and valleys','caption','Draw the interior lines; linear footage updates live.'),
    jsonb_build_object('src','/marketing/screens/m6_label.jpg','title','Label each edge','caption','Pick a type once, then tap every edge that matches.'),
    jsonb_build_object('src','/marketing/screens/m7_labeled.jpg','title','Labeled and totaled','caption','90.4 squares at 10:12 — ready for the takeoff.'))
), 20),
('steps', 'Home — Seven taps', jsonb_build_object(
  'eyebrow','Address to labeled roof',
  'heading','Seven taps, and the roof is measured.',
  'body','This is the real thing, frame by frame — pin, trace, drag the corners onto the actual roof, draw the ridges and hips, label each edge. Squares and linear footage update the whole way through.',
  'chips', jsonb_build_array('One outline per structure','Drag any corner','Draw by hand too','Every edge gets a type'),
  'cta', jsonb_build_object('label','Measure your address on a call','href','/cb/signup'),
  'onsite_eyebrow','The visit',
  'onsite_heading','What happens on site',
  'onsite', jsonb_build_array(
    jsonb_build_object('num','01','title','Measure','body','Pin the address, trace the roof from satellite, label every edge before you get out of the truck.'),
    jsonb_build_object('num','02','title','Roof','body','Slope by slope: test squares, damage counts, flashings, penetrations, photos tied to the facet.'),
    jsonb_build_object('num','03','title','Exterior','body','Four elevations, gutters, screens, soft metals — wide shots plus the close-ups that prove it.'),
    jsonb_build_object('num','04','title','Interior','body','Ceilings, walls and the attic. Every room you enter is documented or marked not inspected.'),
    jsonb_build_object('num','05','title','Deliver','body','Measurement report, photo report, carrier-style estimate and the contract — before you leave.'))
), 30),
('inspections', 'Home — Three inspections, one job', jsonb_build_object(
  'eyebrow','Three inspections, one job',
  'heading','The roof was never the whole claim.',
  'cards', jsonb_build_array(
    jsonb_build_object('chip','Roof','title','Slope by slope','bullets', jsonb_build_array('Test squares with hit counts per slope.','Ridge, hip, valley and flashing condition.','Photos attach to the facet they came from.')),
    jsonb_build_object('chip','Exterior — 4 elevations','title','All the way around','bullets', jsonb_build_array('A wide shot per elevation, prompted in order.','Gutters, downspouts, screens and soft metals.','Collateral damage the adjuster tends to miss.')),
    jsonb_build_object('chip','Interior','title','Inside counts too','bullets', jsonb_build_array('Room by room: ceilings, walls, windows, attic.','Stains and leaks tied back to the slope above.','Skip it and the report prints Not inspected — never a blank.'))),
  'split_heading','One progress list, all three inspections',
  'split_body_1','The rep never wonders what is left. Roof, exterior and interior live in the same checklist with the same counter, so a job is either finished or it tells you exactly which item is not. Pick it up on the next visit and it opens on the step you stopped at.',
  'split_body_2','Nothing is optional by accident — an item you deliberately skip is recorded as skipped and prints that way on the report.',
  'split_image','/marketing/screens/progress.jpg'
), 40),
('why_switch', 'Home — Why reps switch', jsonb_build_object(
  'eyebrow','The difference',
  'heading','Why reps switch',
  'stats', jsonb_build_array(
    jsonb_build_object('value','~10s','label','Address to traced footprint.'),
    jsonb_build_object('value','0×','label','Re-keying between measurement, estimate and contract.'),
    jsonb_build_object('value','4 docs','label','What you leave with: measurements, photos, estimate, contract.'))
), 50),
('quote', 'Home — Pull quote', jsonb_build_object(
  'quote','The rep who documents the whole loss on the first visit does not go back for photos, and does not negotiate from a scope the carrier wrote.'
), 60),
('about', 'Home — About', jsonb_build_object(
  'eyebrow','About',
  'heading','Built by a roofer, on real claims.',
  'body_1','Global Contractor Network is a Florida restoration contractor. Claim Buddy started as the tool we needed on our own storm routes — measurements that hold up, an inspection that covers the whole loss, and paperwork the homeowner can sign at the table.',
  'body_2','gcn.claims runs in the phone browser, so there is nothing to install and nothing to sync. The same measurement and estimating engine powers globalcontractor.app, the full production platform our own crews run on every day.',
  'mini', jsonb_build_array(
    jsonb_build_object('value','FL','label','Licensed restoration contractor'),
    jsonb_build_object('value','3','label','Inspections in every job'),
    jsonb_build_object('value','1','label','Engine behind both products'),
    jsonb_build_object('value','0','label','Desktop software required'))
), 70),
('cta', 'Home — Closing CTA', jsonb_build_object(
  'heading','We measure a roof you know on the call.',
  'body','Bring an address you have already been to. We will trace it live and you can check the squares against your own numbers.',
  'primary_cta', jsonb_build_object('label','Book a demo','href','/cb/signup'),
  'secondary_cta', jsonb_build_object('label','See pricing','href','/#pricing')
), 80),
('pricing_intro', 'Pricing — Intro', jsonb_build_object(
  'heading','Priced per seat, not per claim.',
  'body','One price per rep, per month. Unlimited inspections, unlimited measurements, unlimited reports — the harder your team works, the cheaper it gets.',
  'seat_band_note','The discount applies automatically to every seat once you cross the band.'
), 90),
('resources_intro', 'Resources — Intro', jsonb_build_object(
  'heading','The Blue Collar Sales Survival Guide.',
  'body','Everything we wish somebody had handed us on day one — written for reps who work in boots, read on a phone, and need an answer between doors. It lives inside the app, so it is always one tap away.',
  'ramp_sub','Seven days from hired to their first signed contract. One focus per day — no theory days, no shadowing for a week.',
  'video_sub','Short clips from real jobs. Nothing staged, nothing sped up.'
), 100),
('demo_intro', 'Demo — Intro', jsonb_build_object(
  'heading','See it on your own roof.',
  'body','Give us an address you are working right now. We will measure it live on the call and you keep the report, whether you buy anything or not.'
), 110);