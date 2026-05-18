
-- report_templates
CREATE TABLE public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view templates" ON public.report_templates
  FOR SELECT TO authenticated USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Company members insert templates" ON public.report_templates
  FOR INSERT TO authenticated WITH CHECK (company_id = auth_company_id());
CREATE POLICY "Company members update templates" ON public.report_templates
  FOR UPDATE TO authenticated USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Company admins delete templates" ON public.report_templates
  FOR DELETE TO authenticated USING ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());

CREATE TRIGGER tr_report_templates_updated_at BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- job_reports
CREATE TABLE public.job_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE,
  company_id uuid NOT NULL,
  template_id uuid,
  rep_user_id uuid,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view job_reports" ON public.job_reports
  FOR SELECT TO authenticated USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Company members insert job_reports" ON public.job_reports
  FOR INSERT TO authenticated WITH CHECK (company_id = auth_company_id());
CREATE POLICY "Company members update job_reports" ON public.job_reports
  FOR UPDATE TO authenticated USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Company members delete job_reports" ON public.job_reports
  FOR DELETE TO authenticated USING (company_id = auth_company_id() OR is_super_admin());

CREATE TRIGGER tr_job_reports_updated_at BEFORE UPDATE ON public.job_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- report_assets
CREATE TABLE public.report_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  job_id uuid,
  kind text NOT NULL,
  storage_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'report-assets',
  mime_type text,
  file_size bigint,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.report_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view report_assets" ON public.report_assets
  FOR SELECT TO authenticated USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Company members insert report_assets" ON public.report_assets
  FOR INSERT TO authenticated WITH CHECK (company_id = auth_company_id());
CREATE POLICY "Company members delete report_assets" ON public.report_assets
  FOR DELETE TO authenticated USING (company_id = auth_company_id() OR is_super_admin());

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('report-assets', 'report-assets', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company members read report-assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-assets' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members upload report-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-assets' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members update report-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'report-assets' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members delete report-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-assets' AND (storage.foldername(name))[1] = auth_company_id()::text);
