ALTER TABLE public.storm_mailers
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'modern',
  ADD COLUMN IF NOT EXISTS qr_url text,
  ADD COLUMN IF NOT EXISTS qr_label text,
  ADD COLUMN IF NOT EXISTS doc_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rendered_html text;