ALTER TABLE public.property_dispositions
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS claim_number text,
  ADD COLUMN IF NOT EXISTS deductible numeric,
  ADD COLUMN IF NOT EXISTS cb_job_id uuid;