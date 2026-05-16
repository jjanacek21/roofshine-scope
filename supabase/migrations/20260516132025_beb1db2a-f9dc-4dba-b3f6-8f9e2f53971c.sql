
-- Job documents table
CREATE TABLE public.job_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('measurement_report','work_order','contract','contingency','completed_report','upload','other')),
  title text NOT NULL,
  bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size bigint,
  source_table text,
  source_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_documents_job ON public.job_documents(job_id);
CREATE INDEX idx_job_documents_company ON public.job_documents(company_id);

ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view job documents"
  ON public.job_documents FOR SELECT TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company members insert job documents"
  ON public.job_documents FOR INSERT TO authenticated
  WITH CHECK (company_id = auth_company_id());

CREATE POLICY "Company members update job documents"
  ON public.job_documents FOR UPDATE TO authenticated
  USING (company_id = auth_company_id());

CREATE POLICY "Company members delete job documents"
  ON public.job_documents FOR DELETE TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

-- Private storage bucket for job documents uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('job-documents', 'job-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company members read job-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'job-documents' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members upload job-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'job-documents' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members update job-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'job-documents' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members delete job-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'job-documents' AND (storage.foldername(name))[1] = auth_company_id()::text);
