
ALTER TABLE public.property_dispositions
  ADD COLUMN IF NOT EXISTS converted_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_property_dispositions_user_updated
  ON public.property_dispositions (user_id, updated_at DESC);
