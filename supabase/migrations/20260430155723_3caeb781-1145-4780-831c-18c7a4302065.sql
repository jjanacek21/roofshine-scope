-- Add hierarchy + costing columns to line_item_master
ALTER TABLE public.line_item_master
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS subgroup text,
  ADD COLUMN IF NOT EXISTS xactimate_prefix text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS hours numeric,
  ADD COLUMN IF NOT EXISTS material_cost numeric,
  ADD COLUMN IF NOT EXISTS price_book_code text;

CREATE INDEX IF NOT EXISTS idx_line_item_master_domain_subgroup
  ON public.line_item_master (domain, subgroup);

CREATE INDEX IF NOT EXISTS idx_line_item_master_code
  ON public.line_item_master (code);

-- Wipe old catalog: clear macro item refs first (table is empty anyway), then items
DELETE FROM public.master_macro_items
  WHERE line_item_master_id IN (SELECT id FROM public.line_item_master);

DELETE FROM public.line_item_prices
  WHERE line_item_master_id IN (SELECT id FROM public.line_item_master);

DELETE FROM public.line_item_master;