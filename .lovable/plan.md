

## Add "Price Books" to the Admin sidebar

The master price book system is already fully built and live:
- `/admin/price-books` — list of all global default books
- `/admin/price-books/new` — 3-step wizard (metadata → upload → match) that inserts with `company_id = NULL` + `is_default = true`
- DB + RLS already lets every company read these as fallback
- Resolver (`resolve-price-book.ts`) already prefers company books, then falls back to master defaults by ZIP / jurisdiction / generic

The only gap is **discoverability**: the admin sidebar in `src/routes/admin.tsx` (lines 12–26) does not list Price Books, so super-admins have no UI link to reach it.

### Change

**`src/routes/admin.tsx`** — add one entry to the `NAV` array:

```ts
{ to: "/admin/price-books", label: "Price Books", icon: Library }
```

- Add `Library` to the `lucide-react` import on line 5.
- Insert the nav item between "Companies" and "Announcements" so it sits with other content-management items.

That's the entire fix. Once it ships you'll see "Price Books" in the left admin nav → click → "Upload master book" → wizard. The book auto-applies to every company that doesn't have its own matching book.

### How it works for end users (no extra work needed)
- When any company creates a job, `resolvePriceBook()` runs in this priority: company-ZIP > company-jurisdiction > master-ZIP > master-jurisdiction > master-default.
- The `PriceBookPicker` on the job shows the resolved book with a manual override dropdown, and labels master books with a ★.

### Out of scope
- No DB changes — schema, RLS, and routes are already in place.
- No changes to the company-side `/price-books` page — it already shows master books mixed in (sorted with `is_default` first).

