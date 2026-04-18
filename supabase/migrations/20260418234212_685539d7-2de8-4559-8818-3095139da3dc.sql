-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.companion_rule_type AS ENUM ('required','recommended','conditional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ EXTEND line_item_master ============
ALTER TABLE public.line_item_master
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_line_item_master_company_code
  ON public.line_item_master(company_id, code);

-- ============ EXTEND price_books ============
ALTER TABLE public.price_books
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS zip_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS effective_month date,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS source_file_url text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_price_books_company_active
  ON public.price_books(company_id, is_active, effective_month DESC);

-- ============ EXTEND jobs ============
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS property_id uuid,
  ADD COLUMN IF NOT EXISTS price_book_id uuid,
  ADD COLUMN IF NOT EXISTS job_type text,
  ADD COLUMN IF NOT EXISTS claim_number text,
  ADD COLUMN IF NOT EXISTS insurance_carrier text;

CREATE INDEX IF NOT EXISTS idx_jobs_company_primary_trade
  ON public.jobs(company_id, primary_trade);

-- ============ NEW TABLE: properties ============
CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid NOT NULL,
  address text NOT NULL,
  city text,
  state text,
  zip text,
  lat numeric,
  lng numeric,
  property_type text,
  year_built integer,
  roof_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_properties_company ON public.properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_client ON public.properties(client_id);
CREATE INDEX IF NOT EXISTS idx_properties_zip ON public.properties(zip);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view properties" ON public.properties
  FOR SELECT TO authenticated USING (company_id = auth_company_id());
CREATE POLICY "Company members insert properties" ON public.properties
  FOR INSERT TO authenticated WITH CHECK (company_id = auth_company_id());
CREATE POLICY "Company members update properties" ON public.properties
  FOR UPDATE TO authenticated USING (company_id = auth_company_id());
CREATE POLICY "Company members delete properties" ON public.properties
  FOR DELETE TO authenticated USING (company_id = auth_company_id());
CREATE POLICY "Super admins manage properties" ON public.properties
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NEW TABLE: line_item_prices ============
CREATE TABLE IF NOT EXISTS public.line_item_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_book_id uuid NOT NULL,
  line_item_master_id uuid NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  labor_pct numeric,
  material_pct numeric,
  equipment_pct numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_item_prices_book ON public.line_item_prices(price_book_id);
CREATE INDEX IF NOT EXISTS idx_line_item_prices_item ON public.line_item_prices(line_item_master_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_line_item_prices_unique
  ON public.line_item_prices(price_book_id, line_item_master_id);

ALTER TABLE public.line_item_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view line item prices" ON public.line_item_prices
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.price_books pb
            WHERE pb.id = line_item_prices.price_book_id
              AND pb.company_id = auth_company_id())
  );
CREATE POLICY "Company members insert line item prices" ON public.line_item_prices
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.price_books pb
            WHERE pb.id = line_item_prices.price_book_id
              AND pb.company_id = auth_company_id())
  );
CREATE POLICY "Company members update line item prices" ON public.line_item_prices
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.price_books pb
            WHERE pb.id = line_item_prices.price_book_id
              AND pb.company_id = auth_company_id())
  );
CREATE POLICY "Company members delete line item prices" ON public.line_item_prices
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.price_books pb
            WHERE pb.id = line_item_prices.price_book_id
              AND pb.company_id = auth_company_id())
  );
CREATE POLICY "Super admins manage line item prices" ON public.line_item_prices
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============ NEW TABLE: companion_rules ============
CREATE TABLE IF NOT EXISTS public.companion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  trigger_category text NOT NULL,
  trigger_trade public.trade_type,
  suggested_codes text[] NOT NULL DEFAULT '{}',
  rule_type public.companion_rule_type NOT NULL DEFAULT 'recommended',
  jurisdiction text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_rules_company ON public.companion_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_companion_rules_trade ON public.companion_rules(company_id, trigger_trade);

ALTER TABLE public.companion_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view companion rules" ON public.companion_rules
  FOR SELECT TO authenticated USING (company_id = auth_company_id());
CREATE POLICY "Company members insert companion rules" ON public.companion_rules
  FOR INSERT TO authenticated WITH CHECK (company_id = auth_company_id() AND is_company_admin());
CREATE POLICY "Company members update companion rules" ON public.companion_rules
  FOR UPDATE TO authenticated USING (company_id = auth_company_id() AND is_company_admin());
CREATE POLICY "Company members delete companion rules" ON public.companion_rules
  FOR DELETE TO authenticated USING (company_id = auth_company_id() AND is_company_admin());
CREATE POLICY "Super admins manage companion rules" ON public.companion_rules
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE TRIGGER trg_companion_rules_updated_at
  BEFORE UPDATE ON public.companion_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ STORAGE BUCKET: xactimate-uploads ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('xactimate-uploads', 'xactimate-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company members read own xactimate uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'xactimate-uploads'
    AND (storage.foldername(name))[1] = auth_company_id()::text
  );

CREATE POLICY "Company members upload own xactimate files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'xactimate-uploads'
    AND (storage.foldername(name))[1] = auth_company_id()::text
  );

CREATE POLICY "Company members delete own xactimate files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'xactimate-uploads'
    AND (storage.foldername(name))[1] = auth_company_id()::text
  );