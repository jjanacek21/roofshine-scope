-- Wipe all existing pricing data
DELETE FROM public.line_item_prices;
DELETE FROM public.company_macro_pricing;
UPDATE public.estimate_line_items SET line_item_id = NULL WHERE line_item_id IS NOT NULL;
DELETE FROM public.price_books;
DELETE FROM public.line_item_master;

-- Add a human label for markets on price_books
ALTER TABLE public.price_books
  ADD COLUMN IF NOT EXISTS region_name TEXT;

-- Allow super admins to insert/update/delete master (default, company_id NULL) price books.
-- Existing policies only let company members manage non-default books; super admin ALL
-- policy already exists for the default case. We keep it.
