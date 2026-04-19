
-- Job photos table for AI analysis & estimate matching
CREATE TABLE public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  uploaded_by uuid,
  storage_path text NOT NULL,
  caption text,
  trade_hint text,
  ai_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_photos_job ON public.job_photos(job_id);
CREATE INDEX idx_job_photos_company ON public.job_photos(company_id);

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view job photos"
  ON public.job_photos FOR SELECT TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company members insert job photos"
  ON public.job_photos FOR INSERT TO authenticated
  WITH CHECK (company_id = auth_company_id());

CREATE POLICY "Company members update job photos"
  ON public.job_photos FOR UPDATE TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company members delete job photos"
  ON public.job_photos FOR DELETE TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE TRIGGER update_job_photos_updated_at
  BEFORE UPDATE ON public.job_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for existing roof-photos bucket (re-used for job photos too)
-- Files keyed under {company_id}/{job_id}/{filename}
CREATE POLICY "Company members read roof-photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'roof-photos'
    AND (storage.foldername(name))[1] = auth_company_id()::text
  );

CREATE POLICY "Company members upload roof-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'roof-photos'
    AND (storage.foldername(name))[1] = auth_company_id()::text
  );

CREATE POLICY "Company members update roof-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'roof-photos'
    AND (storage.foldername(name))[1] = auth_company_id()::text
  );

CREATE POLICY "Company members delete roof-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'roof-photos'
    AND (storage.foldername(name))[1] = auth_company_id()::text
  );
