-- ============================================================
-- ROUND A: Pricing tiers + Roof measurements foundation
-- ============================================================

-- 1. Price books: allow global "default" books + pricing_type
ALTER TABLE public.price_books
  ALTER COLUMN company_id DROP NOT NULL;

DO $$ BEGIN
  CREATE TYPE public.price_book_pricing_type AS ENUM ('default', 'insurance', 'retail');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.price_books
  ADD COLUMN IF NOT EXISTS pricing_type public.price_book_pricing_type NOT NULL DEFAULT 'insurance',
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Replace company-only RLS with policies that also handle global default books
DROP POLICY IF EXISTS "Company members view price books" ON public.price_books;
DROP POLICY IF EXISTS "Company members insert price books" ON public.price_books;
DROP POLICY IF EXISTS "Company members update price books" ON public.price_books;
DROP POLICY IF EXISTS "Company members delete price books" ON public.price_books;

CREATE POLICY "View company or default price books"
  ON public.price_books FOR SELECT
  TO authenticated
  USING (
    company_id = auth_company_id()
    OR (is_default = true AND company_id IS NULL)
    OR is_super_admin()
  );

CREATE POLICY "Company members insert their price books"
  ON public.price_books FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = auth_company_id()
    AND is_default = false
    AND pricing_type IN ('insurance', 'retail')
  );

CREATE POLICY "Company members update their price books"
  ON public.price_books FOR UPDATE
  TO authenticated
  USING (company_id = auth_company_id() AND is_default = false);

CREATE POLICY "Company members delete their price books"
  ON public.price_books FOR DELETE
  TO authenticated
  USING (company_id = auth_company_id() AND is_default = false);

CREATE POLICY "Super admins manage default price books"
  ON public.price_books FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Update line_item_prices RLS so users can read prices on default books
DROP POLICY IF EXISTS "Company members view line item prices" ON public.line_item_prices;
CREATE POLICY "View prices for accessible price books"
  ON public.line_item_prices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.price_books pb
      WHERE pb.id = line_item_prices.price_book_id
        AND (pb.company_id = auth_company_id()
             OR (pb.is_default = true AND pb.company_id IS NULL)
             OR is_super_admin())
    )
  );

-- ============================================================
-- 2. Roof measurement enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.roof_measurement_source AS ENUM (
    'manual', 'mapbox_draw', 'google_solar', 'third_party_report', 'photo_ai'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.roof_edge_type AS ENUM (
    'eave', 'rake', 'hip', 'ridge', 'valley',
    'gutter', 'wall_flashing', 'step_flashing', 'transition'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 3. roof_measurements (one per property)
-- ============================================================
CREATE TABLE public.roof_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  source public.roof_measurement_source NOT NULL DEFAULT 'manual',
  predominant_pitch text,
  waste_pct numeric NOT NULL DEFAULT 15,
  squares numeric NOT NULL DEFAULT 0,
  total_area_sqft numeric NOT NULL DEFAULT 0,
  eaves_lf numeric NOT NULL DEFAULT 0,
  rakes_lf numeric NOT NULL DEFAULT 0,
  ridges_lf numeric NOT NULL DEFAULT 0,
  hips_lf numeric NOT NULL DEFAULT 0,
  valleys_lf numeric NOT NULL DEFAULT 0,
  gutters_lf numeric NOT NULL DEFAULT 0,
  wall_flashing_lf numeric NOT NULL DEFAULT 0,
  step_flashing_lf numeric NOT NULL DEFAULT 0,
  transition_lf numeric NOT NULL DEFAULT 0,
  source_file_url text,
  ai_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id)
);

CREATE INDEX idx_roof_measurements_property ON public.roof_measurements(property_id);
CREATE INDEX idx_roof_measurements_company ON public.roof_measurements(company_id);

ALTER TABLE public.roof_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view roof measurements"
  ON public.roof_measurements FOR SELECT TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Company members insert roof measurements"
  ON public.roof_measurements FOR INSERT TO authenticated
  WITH CHECK (company_id = auth_company_id());
CREATE POLICY "Company members update roof measurements"
  ON public.roof_measurements FOR UPDATE TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());
CREATE POLICY "Company members delete roof measurements"
  ON public.roof_measurements FOR DELETE TO authenticated
  USING (company_id = auth_company_id() OR is_super_admin());

CREATE TRIGGER update_roof_measurements_updated_at
  BEFORE UPDATE ON public.roof_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. roof_sections (multiple polygons per measurement)
-- ============================================================
CREATE TABLE public.roof_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.roof_measurements(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Section',
  color text NOT NULL DEFAULT '#3b82f6',
  polygon_geojson jsonb NOT NULL,
  plan_area_sqft numeric NOT NULL DEFAULT 0,
  pitch text NOT NULL DEFAULT '6/12',
  pitch_multiplier numeric NOT NULL DEFAULT 1.118,
  actual_area_sqft numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_roof_sections_measurement ON public.roof_sections(measurement_id);

ALTER TABLE public.roof_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View roof sections via measurement"
  ON public.roof_sections FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_measurements rm
    WHERE rm.id = roof_sections.measurement_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));
CREATE POLICY "Insert roof sections via measurement"
  ON public.roof_sections FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.roof_measurements rm
    WHERE rm.id = roof_sections.measurement_id
      AND rm.company_id = auth_company_id()
  ));
CREATE POLICY "Update roof sections via measurement"
  ON public.roof_sections FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_measurements rm
    WHERE rm.id = roof_sections.measurement_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));
CREATE POLICY "Delete roof sections via measurement"
  ON public.roof_sections FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_measurements rm
    WHERE rm.id = roof_sections.measurement_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));

CREATE TRIGGER update_roof_sections_updated_at
  BEFORE UPDATE ON public.roof_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. roof_edges (labeled polygon edges)
-- ============================================================
CREATE TABLE public.roof_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.roof_sections(id) ON DELETE CASCADE,
  edge_index integer NOT NULL,
  edge_type public.roof_edge_type NOT NULL,
  length_lf numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_roof_edges_section ON public.roof_edges(section_id);

ALTER TABLE public.roof_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View roof edges via section"
  ON public.roof_edges FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_sections rs
    JOIN public.roof_measurements rm ON rm.id = rs.measurement_id
    WHERE rs.id = roof_edges.section_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));
CREATE POLICY "Insert roof edges via section"
  ON public.roof_edges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.roof_sections rs
    JOIN public.roof_measurements rm ON rm.id = rs.measurement_id
    WHERE rs.id = roof_edges.section_id AND rm.company_id = auth_company_id()
  ));
CREATE POLICY "Update roof edges via section"
  ON public.roof_edges FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_sections rs
    JOIN public.roof_measurements rm ON rm.id = rs.measurement_id
    WHERE rs.id = roof_edges.section_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));
CREATE POLICY "Delete roof edges via section"
  ON public.roof_edges FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_sections rs
    JOIN public.roof_measurements rm ON rm.id = rs.measurement_id
    WHERE rs.id = roof_edges.section_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));

-- ============================================================
-- 6. roof_lines (free-floating labeled lines)
-- ============================================================
CREATE TABLE public.roof_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.roof_measurements(id) ON DELETE CASCADE,
  line_geojson jsonb NOT NULL,
  line_type public.roof_edge_type NOT NULL,
  length_lf numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_roof_lines_measurement ON public.roof_lines(measurement_id);

ALTER TABLE public.roof_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View roof lines via measurement"
  ON public.roof_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_measurements rm
    WHERE rm.id = roof_lines.measurement_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));
CREATE POLICY "Insert roof lines via measurement"
  ON public.roof_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.roof_measurements rm
    WHERE rm.id = roof_lines.measurement_id AND rm.company_id = auth_company_id()
  ));
CREATE POLICY "Update roof lines via measurement"
  ON public.roof_lines FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_measurements rm
    WHERE rm.id = roof_lines.measurement_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));
CREATE POLICY "Delete roof lines via measurement"
  ON public.roof_lines FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.roof_measurements rm
    WHERE rm.id = roof_lines.measurement_id
      AND (rm.company_id = auth_company_id() OR is_super_admin())
  ));

-- ============================================================
-- 7. Storage buckets for roof reports & photos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('roof-reports', 'roof-reports', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('roof-photos', 'roof-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company members read roof reports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'roof-reports' AND (storage.foldername(name))[1] = auth_company_id()::text);
CREATE POLICY "Company members upload roof reports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'roof-reports' AND (storage.foldername(name))[1] = auth_company_id()::text);
CREATE POLICY "Company members delete roof reports"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'roof-reports' AND (storage.foldername(name))[1] = auth_company_id()::text);

CREATE POLICY "Company members read roof photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'roof-photos' AND (storage.foldername(name))[1] = auth_company_id()::text);
CREATE POLICY "Company members upload roof photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'roof-photos' AND (storage.foldername(name))[1] = auth_company_id()::text);
CREATE POLICY "Company members delete roof photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'roof-photos' AND (storage.foldername(name))[1] = auth_company_id()::text);