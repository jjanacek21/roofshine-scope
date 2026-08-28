CREATE TABLE public.roof_template_code_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_code text NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  target_code text,
  qty_factor numeric NOT NULL DEFAULT 1,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX roof_template_code_map_slot_company_uniq
  ON public.roof_template_code_map (slot_code, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roof_template_code_map TO authenticated;
GRANT ALL ON public.roof_template_code_map TO service_role;
ALTER TABLE public.roof_template_code_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read code map"
  ON public.roof_template_code_map FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Admins manage code map"
  ON public.roof_template_code_map FOR ALL TO authenticated
  USING (is_super_admin() OR (company_id = auth_company_id() AND is_company_admin()))
  WITH CHECK (is_super_admin() OR (company_id = auth_company_id() AND is_company_admin()));

CREATE TABLE public.ai_reference_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  category text NOT NULL DEFAULT 'roof_hardware',
  trade text NOT NULL DEFAULT 'roofing',
  line_item_code text,
  default_unit text,
  notes text,
  storage_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'ai-reference-photos',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_reference_photos TO authenticated;
GRANT ALL ON public.ai_reference_photos TO service_role;
ALTER TABLE public.ai_reference_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in can read reference photos"
  ON public.ai_reference_photos FOR SELECT TO authenticated USING (is_active OR is_super_admin());
CREATE POLICY "Super admins manage reference photos"
  ON public.ai_reference_photos FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE TABLE public.photo_learning_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  trade text,
  asset_type text,
  match_phrase text NOT NULL,
  wrong_code text,
  correct_code text,
  correct_unit text,
  guidance text,
  hits integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX photo_learning_rules_company_idx ON public.photo_learning_rules (company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_learning_rules TO authenticated;
GRANT ALL ON public.photo_learning_rules TO service_role;
ALTER TABLE public.photo_learning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read learning rules"
  ON public.photo_learning_rules FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Admins manage learning rules"
  ON public.photo_learning_rules FOR ALL TO authenticated
  USING (is_super_admin() OR (company_id = auth_company_id() AND is_company_admin()))
  WITH CHECK (is_super_admin() OR (company_id = auth_company_id() AND is_company_admin()));

CREATE TRIGGER update_roof_template_code_map_updated_at BEFORE UPDATE ON public.roof_template_code_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_reference_photos_updated_at BEFORE UPDATE ON public.ai_reference_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_photo_learning_rules_updated_at BEFORE UPDATE ON public.photo_learning_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();