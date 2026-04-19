-- 1. Allow global (master) catalog items: line_item_master.company_id nullable
ALTER TABLE public.line_item_master ALTER COLUMN company_id DROP NOT NULL;

-- Drop and recreate select policy to include global rows
DROP POLICY IF EXISTS "Company members view catalog" ON public.line_item_master;
CREATE POLICY "View company or master catalog"
  ON public.line_item_master
  FOR SELECT
  TO authenticated
  USING (company_id = auth_company_id() OR company_id IS NULL OR is_super_admin());

-- Only super admins can insert/update/delete master rows; company members manage their own
DROP POLICY IF EXISTS "Company members insert catalog" ON public.line_item_master;
CREATE POLICY "Company members insert catalog"
  ON public.line_item_master
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = auth_company_id());

DROP POLICY IF EXISTS "Company members update catalog" ON public.line_item_master;
CREATE POLICY "Company members update catalog"
  ON public.line_item_master
  FOR UPDATE
  TO authenticated
  USING (company_id = auth_company_id());

DROP POLICY IF EXISTS "Company members delete catalog" ON public.line_item_master;
CREATE POLICY "Company members delete catalog"
  ON public.line_item_master
  FOR DELETE
  TO authenticated
  USING (company_id = auth_company_id());

CREATE POLICY "Super admins manage master catalog"
  ON public.line_item_master
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- 2. Cost-build columns on line_item_prices for retail pricing
ALTER TABLE public.line_item_prices
  ADD COLUMN IF NOT EXISTS material_cost numeric,
  ADD COLUMN IF NOT EXISTS labor_cost numeric,
  ADD COLUMN IF NOT EXISTS equipment_cost numeric,
  ADD COLUMN IF NOT EXISTS misc_cost numeric,
  ADD COLUMN IF NOT EXISTS overhead_pct numeric;

-- 3. ZIP lookup index for fast resolution
CREATE INDEX IF NOT EXISTS price_books_zip_codes_gin ON public.price_books USING gin(zip_codes);
CREATE INDEX IF NOT EXISTS price_books_jurisdiction_idx ON public.price_books (jurisdiction);
CREATE INDEX IF NOT EXISTS line_item_master_company_trade_idx ON public.line_item_master (company_id, trade);