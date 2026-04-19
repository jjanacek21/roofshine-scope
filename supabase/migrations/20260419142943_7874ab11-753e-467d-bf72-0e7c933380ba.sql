
-- 1. master_macros
CREATE TABLE public.master_macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trade public.trade_type,
  category text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.master_macros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View master or company macros"
  ON public.master_macros FOR SELECT
  TO authenticated
  USING (company_id IS NULL OR company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Super admins manage master macros"
  ON public.master_macros FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Company admins insert their macros"
  ON public.master_macros FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth_company_id() AND is_company_admin());

CREATE POLICY "Company admins update their macros"
  ON public.master_macros FOR UPDATE
  TO authenticated
  USING (company_id = auth_company_id() AND is_company_admin());

CREATE POLICY "Company admins delete their macros"
  ON public.master_macros FOR DELETE
  TO authenticated
  USING (company_id = auth_company_id() AND is_company_admin());

CREATE TRIGGER update_master_macros_updated_at
  BEFORE UPDATE ON public.master_macros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. master_macro_items
CREATE TABLE public.master_macro_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_id uuid NOT NULL REFERENCES public.master_macros(id) ON DELETE CASCADE,
  line_item_master_id uuid NOT NULL REFERENCES public.line_item_master(id) ON DELETE CASCADE,
  qty numeric NOT NULL DEFAULT 1,
  unit text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.master_macro_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View macro items via macro"
  ON public.master_macro_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.master_macros m
    WHERE m.id = master_macro_items.macro_id
      AND (m.company_id IS NULL OR m.company_id = auth_company_id() OR is_super_admin())
  ));

CREATE POLICY "Super admins manage master macro items"
  ON public.master_macro_items FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Company admins manage their macro items"
  ON public.master_macro_items FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.master_macros m
    WHERE m.id = master_macro_items.macro_id
      AND m.company_id = auth_company_id()
      AND is_company_admin()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.master_macros m
    WHERE m.id = master_macro_items.macro_id
      AND m.company_id = auth_company_id()
      AND is_company_admin()
  ));

CREATE INDEX idx_master_macro_items_macro_id ON public.master_macro_items(macro_id);

-- 3. company_macro_pricing
CREATE TABLE public.company_macro_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  macro_id uuid NOT NULL REFERENCES public.master_macros(id) ON DELETE CASCADE,
  line_item_master_id uuid NOT NULL REFERENCES public.line_item_master(id) ON DELETE CASCADE,
  unit_price numeric NOT NULL DEFAULT 0,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, macro_id, line_item_master_id)
);

ALTER TABLE public.company_macro_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view macro pricing"
  ON public.company_macro_pricing FOR SELECT
  TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company admins insert macro pricing"
  ON public.company_macro_pricing FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth_company_id() AND is_company_admin());

CREATE POLICY "Company admins update macro pricing"
  ON public.company_macro_pricing FOR UPDATE
  TO authenticated
  USING (company_id = auth_company_id() AND is_company_admin());

CREATE POLICY "Company admins delete macro pricing"
  ON public.company_macro_pricing FOR DELETE
  TO authenticated
  USING (company_id = auth_company_id() AND is_company_admin());

CREATE TRIGGER update_company_macro_pricing_updated_at
  BEFORE UPDATE ON public.company_macro_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_company_macro_pricing_company_macro
  ON public.company_macro_pricing(company_id, macro_id);

-- 4. companies: auto-add toggle
ALTER TABLE public.companies
  ADD COLUMN auto_add_photo_suggestions boolean NOT NULL DEFAULT false;

-- 5. estimate_line_items: source flag
ALTER TABLE public.estimate_line_items
  ADD COLUMN source text NOT NULL DEFAULT 'manual';
