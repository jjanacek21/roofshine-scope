
-- jobs: jurisdiction
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS jurisdiction text;

-- estimates: tier + markup/overhead/profit/tax/notes/hide_pricing
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS markup_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS hide_pricing boolean NOT NULL DEFAULT false;

-- job_photos: tag, taken_at, exif_gps
ALTER TABLE public.job_photos
  ADD COLUMN IF NOT EXISTS tag text,
  ADD COLUMN IF NOT EXISTS taken_at timestamptz,
  ADD COLUMN IF NOT EXISTS exif_gps jsonb;

-- companies: defaults + blurbs + licenses
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS default_markup_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_overhead_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_profit_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS warranty_blurb text,
  ADD COLUMN IF NOT EXISTS financing_blurb text,
  ADD COLUMN IF NOT EXISTS license_numbers text[] NOT NULL DEFAULT '{}';

-- generated_reports table
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  estimate_id uuid,
  company_id uuid NOT NULL,
  pdf_path text NOT NULL,
  hide_pricing boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view generated reports"
  ON public.generated_reports FOR SELECT TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company members insert generated reports"
  ON public.generated_reports FOR INSERT TO authenticated
  WITH CHECK (company_id = auth_company_id());

CREATE POLICY "Company members delete generated reports"
  ON public.generated_reports FOR DELETE TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE INDEX IF NOT EXISTS idx_generated_reports_job ON public.generated_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_company ON public.generated_reports(company_id);

-- generated-pdfs bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-pdfs', 'generated-pdfs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company members read generated pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'generated-pdfs'
    AND (
      (storage.foldername(name))[1] = auth_company_id()::text
      OR is_super_admin()
    )
  );

CREATE POLICY "Company members upload generated pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'generated-pdfs'
    AND (storage.foldername(name))[1] = auth_company_id()::text
  );

CREATE POLICY "Company members delete generated pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'generated-pdfs'
    AND (
      (storage.foldername(name))[1] = auth_company_id()::text
      OR is_super_admin()
    )
  );
