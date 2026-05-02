-- Add a unique constraint to support upsert during bulk lead imports.
-- Address is normalized to lower(trim()) for dedup purposes.
CREATE UNIQUE INDEX IF NOT EXISTS leads_company_address_unique
  ON public.leads (company_id, lower(btrim(address)));