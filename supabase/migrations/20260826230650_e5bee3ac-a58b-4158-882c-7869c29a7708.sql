-- JOB 1
CREATE OR REPLACE FUNCTION public.has_commercial_module()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.company_has_feature(public.auth_company_id(), 'commercial'); $$;

DROP POLICY IF EXISTS "rk_accounts company access" ON public.rk_accounts;
CREATE POLICY "rk_accounts company access" ON public.rk_accounts FOR ALL
  USING (is_super_admin() OR ((company_id = auth_company_id()) AND has_commercial_module()))
  WITH CHECK (is_super_admin() OR ((company_id = auth_company_id()) AND has_commercial_module()));

DROP POLICY IF EXISTS "rk_properties company access" ON public.rk_properties;
CREATE POLICY "rk_properties company access" ON public.rk_properties FOR ALL
  USING (is_super_admin() OR ((company_id = auth_company_id()) AND has_commercial_module()))
  WITH CHECK (is_super_admin() OR ((company_id = auth_company_id()) AND has_commercial_module()));

DROP POLICY IF EXISTS "rk_tickets company access" ON public.rk_tickets;
CREATE POLICY "rk_tickets company access" ON public.rk_tickets FOR ALL
  USING (is_super_admin() OR ((company_id = auth_company_id()) AND has_commercial_module()))
  WITH CHECK (is_super_admin() OR ((company_id = auth_company_id()) AND has_commercial_module()));

DROP POLICY IF EXISTS "rk_form_templates company access" ON public.rk_form_templates;
CREATE POLICY "rk_form_templates company access" ON public.rk_form_templates FOR ALL
  USING (is_super_admin() OR ((company_id = auth_company_id()) AND has_commercial_module()))
  WITH CHECK (is_super_admin() OR ((company_id = auth_company_id()) AND has_commercial_module()));

CREATE OR REPLACE FUNCTION public.rk_next_wo(_company_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_next integer;
BEGIN
  IF NOT (public.is_super_admin()
       OR (_company_id = public.auth_company_id() AND public.has_commercial_module())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT COALESCE(MAX(wo_number), 1000) + 1 INTO v_next
    FROM public.rk_tickets WHERE company_id = _company_id;
  RETURN v_next;
END $$;

DROP FUNCTION IF EXISTS public.is_roof_king_member();

-- JOB 2
ALTER TABLE public.spf_products      ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.spf_details       ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.spf_stacks        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.spf_stack_layers  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.spf_field_defaults ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.spf_calc_settings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.spf_products       SET company_id = 'dfd60203-5a0c-4d07-a437-205c651386e0' WHERE company_id IS NULL;
UPDATE public.spf_details        SET company_id = 'dfd60203-5a0c-4d07-a437-205c651386e0' WHERE company_id IS NULL;
UPDATE public.spf_stacks         SET company_id = 'dfd60203-5a0c-4d07-a437-205c651386e0' WHERE company_id IS NULL;
UPDATE public.spf_field_defaults SET company_id = 'dfd60203-5a0c-4d07-a437-205c651386e0' WHERE company_id IS NULL;
UPDATE public.spf_calc_settings  SET company_id = 'dfd60203-5a0c-4d07-a437-205c651386e0' WHERE company_id IS NULL;
UPDATE public.spf_stack_layers l SET company_id = s.company_id FROM public.spf_stacks s WHERE s.id = l.stack_id AND l.company_id IS NULL;
UPDATE public.spf_stack_layers   SET company_id = 'dfd60203-5a0c-4d07-a437-205c651386e0' WHERE company_id IS NULL;

ALTER TABLE public.spf_products       ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.spf_details        ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.spf_stacks         ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.spf_stack_layers   ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.spf_field_defaults ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.spf_calc_settings  ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.spf_products       ALTER COLUMN company_id SET DEFAULT public.auth_company_id();
ALTER TABLE public.spf_details        ALTER COLUMN company_id SET DEFAULT public.auth_company_id();
ALTER TABLE public.spf_stacks         ALTER COLUMN company_id SET DEFAULT public.auth_company_id();
ALTER TABLE public.spf_stack_layers   ALTER COLUMN company_id SET DEFAULT public.auth_company_id();
ALTER TABLE public.spf_field_defaults ALTER COLUMN company_id SET DEFAULT public.auth_company_id();
ALTER TABLE public.spf_calc_settings  ALTER COLUMN company_id SET DEFAULT public.auth_company_id();

CREATE INDEX IF NOT EXISTS idx_spf_products_company ON public.spf_products(company_id);
CREATE INDEX IF NOT EXISTS idx_spf_details_company ON public.spf_details(company_id);
CREATE INDEX IF NOT EXISTS idx_spf_stacks_company ON public.spf_stacks(company_id);
CREATE INDEX IF NOT EXISTS idx_spf_stack_layers_company ON public.spf_stack_layers(company_id);
CREATE INDEX IF NOT EXISTS idx_spf_field_defaults_company ON public.spf_field_defaults(company_id);
CREATE INDEX IF NOT EXISTS idx_spf_calc_settings_company ON public.spf_calc_settings(company_id);

DROP POLICY IF EXISTS "spf_products read" ON public.spf_products;
DROP POLICY IF EXISTS "spf_products admin write" ON public.spf_products;
DROP POLICY IF EXISTS "spf_details read" ON public.spf_details;
DROP POLICY IF EXISTS "spf_details admin write" ON public.spf_details;
DROP POLICY IF EXISTS "spf_stacks read" ON public.spf_stacks;
DROP POLICY IF EXISTS "spf_stacks admin write" ON public.spf_stacks;
DROP POLICY IF EXISTS "spf_stack_layers read" ON public.spf_stack_layers;
DROP POLICY IF EXISTS "spf_stack_layers admin write" ON public.spf_stack_layers;
DROP POLICY IF EXISTS "spf_field_defaults read" ON public.spf_field_defaults;
DROP POLICY IF EXISTS "spf_field_defaults admin write" ON public.spf_field_defaults;
DROP POLICY IF EXISTS "spf_calc_settings read" ON public.spf_calc_settings;
DROP POLICY IF EXISTS "spf_calc_settings admin write" ON public.spf_calc_settings;

ALTER TABLE public.spf_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spf_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spf_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spf_stack_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spf_field_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spf_calc_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spf_products company access" ON public.spf_products FOR ALL TO authenticated
  USING (is_super_admin() OR company_id = auth_company_id())
  WITH CHECK (is_super_admin() OR company_id = auth_company_id());
CREATE POLICY "spf_details company access" ON public.spf_details FOR ALL TO authenticated
  USING (is_super_admin() OR company_id = auth_company_id())
  WITH CHECK (is_super_admin() OR company_id = auth_company_id());
CREATE POLICY "spf_stacks company access" ON public.spf_stacks FOR ALL TO authenticated
  USING (is_super_admin() OR company_id = auth_company_id())
  WITH CHECK (is_super_admin() OR company_id = auth_company_id());
CREATE POLICY "spf_stack_layers company access" ON public.spf_stack_layers FOR ALL TO authenticated
  USING (is_super_admin() OR company_id = auth_company_id())
  WITH CHECK (is_super_admin() OR company_id = auth_company_id());
CREATE POLICY "spf_field_defaults company access" ON public.spf_field_defaults FOR ALL TO authenticated
  USING (is_super_admin() OR company_id = auth_company_id())
  WITH CHECK (is_super_admin() OR company_id = auth_company_id());
CREATE POLICY "spf_calc_settings company access" ON public.spf_calc_settings FOR ALL TO authenticated
  USING (is_super_admin() OR company_id = auth_company_id())
  WITH CHECK (is_super_admin() OR company_id = auth_company_id());

REVOKE SELECT ON public.spf_products, public.spf_details, public.spf_stacks, public.spf_stack_layers, public.spf_field_defaults, public.spf_calc_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spf_products, public.spf_details, public.spf_stacks, public.spf_stack_layers, public.spf_field_defaults, public.spf_calc_settings TO authenticated;
GRANT ALL ON public.spf_products, public.spf_details, public.spf_stacks, public.spf_stack_layers, public.spf_field_defaults, public.spf_calc_settings TO service_role;