CREATE TABLE public.roof_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  property_id uuid,
  job_id uuid,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  pin_name text,
  pitch text,
  kind text,
  corrected_facets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_facets jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrected_plan_sqft numeric NOT NULL DEFAULT 0,
  ai_plan_sqft numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roof_corrections_latlng ON public.roof_corrections (lat, lng);
CREATE INDEX idx_roof_corrections_property ON public.roof_corrections (property_id);
CREATE INDEX idx_roof_corrections_company ON public.roof_corrections (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roof_corrections TO authenticated;
GRANT ALL ON public.roof_corrections TO service_role;

ALTER TABLE public.roof_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view roof corrections"
  ON public.roof_corrections FOR SELECT TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company members add roof corrections"
  ON public.roof_corrections FOR INSERT TO authenticated
  WITH CHECK ((company_id = auth_company_id() AND created_by = auth.uid()) OR is_super_admin());

CREATE POLICY "Owners update roof corrections"
  ON public.roof_corrections FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_super_admin());

CREATE POLICY "Owners delete roof corrections"
  ON public.roof_corrections FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_super_admin());

CREATE TRIGGER update_roof_corrections_updated_at
  BEFORE UPDATE ON public.roof_corrections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();