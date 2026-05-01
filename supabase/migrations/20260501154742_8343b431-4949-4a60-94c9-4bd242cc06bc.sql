UPDATE public.line_item_master
SET name = regexp_replace(name, '^(Remove|Replace|R&R|R & R)\s+', '', 'i'),
    updated_at = now()
WHERE company_id IS NULL
  AND name ~* '^(Remove|Replace|R&R|R & R)\s+';