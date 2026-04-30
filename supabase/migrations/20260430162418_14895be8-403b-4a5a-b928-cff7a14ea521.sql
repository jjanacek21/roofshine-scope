ALTER TABLE public.line_item_master 
  ADD COLUMN IF NOT EXISTS remove_price numeric,
  ADD COLUMN IF NOT EXISTS replace_price numeric;