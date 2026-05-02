-- Lead Reports
CREATE TABLE IF NOT EXISTS public.lead_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  created_by uuid,
  kind text NOT NULL DEFAULT 'savings',
  name text NOT NULL,
  pdf_path text NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_reports_lead ON public.lead_reports(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_reports_company ON public.lead_reports(company_id);

ALTER TABLE public.lead_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view lead reports"
  ON public.lead_reports FOR SELECT
  TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company members insert lead reports"
  ON public.lead_reports FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth_company_id());

CREATE POLICY "Company admins delete lead reports"
  ON public.lead_reports FOR DELETE
  TO authenticated
  USING ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());

-- Lead Documents
CREATE TABLE IF NOT EXISTS public.lead_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  company_id uuid NOT NULL,
  uploaded_by uuid,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  storage_path text NOT NULL,
  kind text NOT NULL DEFAULT 'document',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_documents_lead ON public.lead_documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_documents_company ON public.lead_documents(company_id);

ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view lead documents"
  ON public.lead_documents FOR SELECT
  TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company members insert lead documents"
  ON public.lead_documents FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth_company_id());

CREATE POLICY "Company admins delete lead documents"
  ON public.lead_documents FOR DELETE
  TO authenticated
  USING ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-reports', 'lead-reports', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-documents', 'lead-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — path layout: <company_id>/<lead_id>/<filename>
CREATE POLICY "Company members read lead-reports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-reports' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members upload lead-reports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-reports' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company admins delete lead-reports"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lead-reports' AND (storage.foldername(name))[1] = auth_company_id()::text AND is_company_admin());

CREATE POLICY "Company members read lead-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-documents' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members upload lead-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-documents' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company admins delete lead-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lead-documents' AND (storage.foldername(name))[1] = auth_company_id()::text AND is_company_admin());