ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS estimate_number text,
  ADD COLUMN IF NOT EXISTS type_of_estimate text,
  ADD COLUMN IF NOT EXISTS price_list_code text,
  ADD COLUMN IF NOT EXISTS show_code_pages boolean NOT NULL DEFAULT false;

ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS subgroup text,
  ADD COLUMN IF NOT EXISTS remove_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replace_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'Main Level';