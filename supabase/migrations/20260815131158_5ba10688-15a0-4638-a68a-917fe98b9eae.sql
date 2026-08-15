
CREATE TABLE public.cb_catalog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  note text,
  is_current boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_catalog_versions TO authenticated;
GRANT ALL ON public.cb_catalog_versions TO service_role;
ALTER TABLE public.cb_catalog_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_catalog_versions_read" ON public.cb_catalog_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_catalog_versions_write" ON public.cb_catalog_versions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.cb_assemblies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.cb_catalog_versions(id) ON DELETE CASCADE,
  roof_system text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX cb_assemblies_version_idx ON public.cb_assemblies (version_id, roof_system);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_assemblies TO authenticated;
GRANT ALL ON public.cb_assemblies TO service_role;
ALTER TABLE public.cb_assemblies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_assemblies_read" ON public.cb_assemblies FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_assemblies_write" ON public.cb_assemblies FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.cb_assembly_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id uuid NOT NULL REFERENCES public.cb_assemblies(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES public.line_item_master(id) ON DELETE SET NULL,
  role text,
  qty_mode text NOT NULL DEFAULT 'fixed',
  qty_factor numeric NOT NULL DEFAULT 1,
  waste_pct numeric NOT NULL DEFAULT 0,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX cb_assembly_items_assembly_idx ON public.cb_assembly_items (assembly_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_assembly_items TO authenticated;
GRANT ALL ON public.cb_assembly_items TO service_role;
ALTER TABLE public.cb_assembly_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_assembly_items_read" ON public.cb_assembly_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_assembly_items_write" ON public.cb_assembly_items FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.cb_item_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.cb_catalog_versions(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.cb_item_catalog(id) ON DELETE CASCADE,
  roof_system text,
  line_item_id uuid REFERENCES public.line_item_master(id) ON DELETE SET NULL,
  qty_mode text NOT NULL DEFAULT 'per_ea',
  qty_factor numeric NOT NULL DEFAULT 1,
  waste_pct numeric NOT NULL DEFAULT 0,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX cb_item_mappings_lookup_idx ON public.cb_item_mappings (version_id, catalog_item_id, roof_system);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cb_item_mappings TO authenticated;
GRANT ALL ON public.cb_item_mappings TO service_role;
ALTER TABLE public.cb_item_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_item_mappings_read" ON public.cb_item_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_item_mappings_write" ON public.cb_item_mappings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TRIGGER cb_catalog_versions_touch BEFORE UPDATE ON public.cb_catalog_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cb_assemblies_touch BEFORE UPDATE ON public.cb_assemblies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cb_assembly_items_touch BEFORE UPDATE ON public.cb_assembly_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cb_item_mappings_touch BEFORE UPDATE ON public.cb_item_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS catalog_version_id uuid REFERENCES public.cb_catalog_versions(id);

ALTER TABLE public.ai_measurement_runs
  ADD COLUMN IF NOT EXISTS raw_geometry jsonb,
  ADD COLUMN IF NOT EXISTS regularized_geometry jsonb,
  ADD COLUMN IF NOT EXISTS final_geometry jsonb,
  ADD COLUMN IF NOT EXISTS area_delta_pct numeric,
  ADD COLUMN IF NOT EXISTS perimeter_delta_pct numeric,
  ADD COLUMN IF NOT EXISTS avg_vertex_shift_ft numeric,
  ADD COLUMN IF NOT EXISTS max_vertex_shift_ft numeric,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS roof_system text,
  ADD COLUMN IF NOT EXISTS rep_overrode boolean NOT NULL DEFAULT false;
