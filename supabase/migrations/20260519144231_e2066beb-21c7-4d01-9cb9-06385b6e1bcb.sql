CREATE TABLE public.company_labor_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  task text NOT NULL,
  uom text NOT NULL,
  rate numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX company_labor_rates_unique_task
  ON public.company_labor_rates (company_id, lower(task), uom);

CREATE INDEX company_labor_rates_company_idx
  ON public.company_labor_rates (company_id, sort_order);

ALTER TABLE public.company_labor_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view labor rates"
  ON public.company_labor_rates FOR SELECT TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE POLICY "Company admins insert labor rates"
  ON public.company_labor_rates FOR INSERT TO authenticated
  WITH CHECK ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());

CREATE POLICY "Company admins update labor rates"
  ON public.company_labor_rates FOR UPDATE TO authenticated
  USING ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());

CREATE POLICY "Company admins delete labor rates"
  ON public.company_labor_rates FOR DELETE TO authenticated
  USING ((company_id = auth_company_id() AND is_company_admin()) OR is_super_admin());

CREATE TRIGGER company_labor_rates_set_updated_at
  BEFORE UPDATE ON public.company_labor_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();