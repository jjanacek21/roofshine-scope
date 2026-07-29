DELETE FROM public.line_item_prices p
WHERE NOT EXISTS (SELECT 1 FROM public.line_item_master m WHERE m.id = p.line_item_master_id)
   OR NOT EXISTS (SELECT 1 FROM public.price_books b WHERE b.id = p.price_book_id);

ALTER TABLE public.line_item_prices
  ADD CONSTRAINT line_item_prices_line_item_master_id_fkey
  FOREIGN KEY (line_item_master_id) REFERENCES public.line_item_master(id) ON DELETE CASCADE;

ALTER TABLE public.line_item_prices
  ADD CONSTRAINT line_item_prices_price_book_id_fkey
  FOREIGN KEY (price_book_id) REFERENCES public.price_books(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_line_item_prices_price_book_id ON public.line_item_prices(price_book_id);
CREATE INDEX IF NOT EXISTS idx_line_item_prices_master_id ON public.line_item_prices(line_item_master_id);