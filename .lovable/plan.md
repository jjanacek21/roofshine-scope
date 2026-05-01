Strip leading `Remove ` / `Replace ` / `R&R ` from every master catalog item name.

## SQL (one statement)

```sql
UPDATE public.line_item_master
SET name = regexp_replace(name, '^(Remove|Replace|R&R|R & R)\s+', '', 'i'),
    updated_at = now()
WHERE company_id IS NULL
  AND name ~* '^(Remove|Replace|R&R|R & R)\s+';
```

## Impact

- Updates ~320 of 428 master catalog items.
- Only renames; `code`, `remove_price`, `replace_price`, `default_price` (R&R total), `domain`, `subgroup`, `unit` stay the same.
- No code changes needed — `MasterCatalogBrowser.tsx` continues to render Remove / Replace / R&R Total columns from the price fields.
- No name collisions introduced (verified).
- Company-scoped items and saved estimate line items are not touched.