CREATE TABLE public.code_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  county text,
  name text NOT NULL,
  effective_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_rule_sets TO authenticated;
GRANT ALL ON public.code_rule_sets TO service_role;
ALTER TABLE public.code_rule_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "code_rule_sets_read" ON public.code_rule_sets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "code_rule_sets_write" ON public.code_rule_sets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.code_rule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id uuid NOT NULL REFERENCES public.code_rule_sets(id) ON DELETE CASCADE,
  applies_to_roof_system text,
  line_item_id uuid REFERENCES public.line_item_master(id) ON DELETE SET NULL,
  item_name text,
  unit text,
  qty_mode text NOT NULL DEFAULT 'fixed',
  qty_factor numeric NOT NULL DEFAULT 1,
  condition text,
  code_reference text NOT NULL,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX code_rule_items_set_idx ON public.code_rule_items(rule_set_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_rule_items TO authenticated;
GRANT ALL ON public.code_rule_items TO service_role;
ALTER TABLE public.code_rule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "code_rule_items_read" ON public.code_rule_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "code_rule_items_write" ON public.code_rule_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_code_rule_sets_updated_at BEFORE UPDATE ON public.code_rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_code_rule_items_updated_at BEFORE UPDATE ON public.code_rule_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cb_jobs ADD COLUMN IF NOT EXISTS county text;

INSERT INTO public.code_rule_sets (state, county, name, notes) VALUES
  ('FL', NULL, 'Florida Building Code — statewide', 'Rule list pending: to be supplied from real carrier estimates. Intentionally empty.'),
  ('FL', 'Miami-Dade', 'Florida Building Code — HVHZ (Miami-Dade)', 'High velocity hurricane zone. Rule list pending.'),
  ('FL', 'Broward', 'Florida Building Code — HVHZ (Broward)', 'High velocity hurricane zone. Rule list pending.');