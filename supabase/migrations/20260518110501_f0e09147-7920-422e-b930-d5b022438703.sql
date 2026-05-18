ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS manual_total numeric,
  ADD COLUMN IF NOT EXISTS use_manual_total boolean NOT NULL DEFAULT false;