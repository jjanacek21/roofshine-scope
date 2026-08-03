ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS depreciation_pct numeric,
  ADD COLUMN IF NOT EXISTS depreciation_amount numeric,
  ADD COLUMN IF NOT EXISTS depreciation_recoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS not_yet_incurred boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_amount numeric;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS deductible numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coverage_label text NOT NULL DEFAULT 'Coverage A - Dwelling',
  ADD COLUMN IF NOT EXISTS report_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS report_notes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS report_profile jsonb NOT NULL DEFAULT '{}'::jsonb;