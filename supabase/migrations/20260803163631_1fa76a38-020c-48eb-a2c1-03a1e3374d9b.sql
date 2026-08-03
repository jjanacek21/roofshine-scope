ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS contract_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS feature_door_to_door boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_storm_intel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feature_roof_king boolean NOT NULL DEFAULT false;

UPDATE public.companies SET feature_roof_king = true WHERE is_roof_king = true;
UPDATE public.companies
  SET feature_door_to_door = true, feature_storm_intel = true, feature_roof_king = true
  WHERE name ILIKE '%global contractor%';

CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  file_url text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view documents" ON public.company_documents
  FOR SELECT TO authenticated USING (company_id = public.auth_company_id());
CREATE POLICY "Company admins manage documents" ON public.company_documents
  FOR ALL TO authenticated
  USING (company_id = public.auth_company_id() AND public.is_company_admin())
  WITH CHECK (company_id = public.auth_company_id() AND public.is_company_admin());
CREATE POLICY "Super admins manage all company documents" ON public.company_documents
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TRIGGER update_company_documents_updated_at
  BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS company_documents_company_idx ON public.company_documents(company_id);