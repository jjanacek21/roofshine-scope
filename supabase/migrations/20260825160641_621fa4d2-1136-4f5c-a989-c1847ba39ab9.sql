ALTER TABLE public.cb_companies
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS license_line text;