## Problem

Admin → Master Pricing still renders the old `price_books` (Xactimate upload) list. The new 428-item hierarchical catalog (Domain → Subgroup → Items) we just imported into `line_item_master` is not displayed anywhere in the admin panel.

## Plan

Replace the "Insurance Pricing" tab on `/admin/price-books` with a new **Master Catalog** view backed by `line_item_master` (where `company_id IS NULL`).

### 1. New `MasterCatalogBrowser` component (`src/components/catalog/MasterCatalogBrowser.tsx`)

Two-pane layout matching the macro editor:

- **Left pane** — collapsible Domain → Subgroup tree with item counts (reuses logic from `CatalogTree`, but in read-only "browser" mode — no checkboxes).
- **Right pane** — table of items in the currently selected subgroup (or all items if a search is active):
  - Columns: Code, Name, Unit, Default Price, Hours, Material Cost, Xactimate Prefix
  - Top: search bar that filters across code/name/description globally
  - Inline-edit `default_price` (and optionally `hours` / `material_cost`) for super-admins via `update line_item_master`.

Pulls all rows once with `select("id, code, name, unit, default_price, domain, subgroup, xactimate_prefix, trade_name, hours, material_cost").is("company_id", null).order("domain").order("subgroup").order("code")`.

### 2. Update `/admin/price-books` route (`src/routes/admin.price-books.tsx`)

Replace the three-tab structure with two tabs:

- **Master Catalog** (new — renders `MasterCatalogBrowser`) — default tab
- **Master Macros** (existing — renders `AdminMacrosPage`)

Remove the legacy `InsuranceList` (price_books table) and the "Upload estimate file" button. The legacy `/admin/price-books/new` upload flow stays in the codebase but is no longer linked from the admin panel (we can delete it in a follow-up once confirmed unused).

Rename the page header to "Master Catalog & Macros" so it matches the new content.

### 3. Sidebar label

Update the admin sidebar entry from "Pricing" / "Price Books" to "Catalog" so it reflects the new model. (Quick check of `src/components/AdminSidebar` or equivalent during implementation.)

## Out of scope

- Bulk CSV re-import UI (data is already loaded via psql).
- Per-company overrides UI (separate feature).
- Removing the legacy `price_books` tables/routes (kept for now in case any older job references them).

## Files

- create `src/components/catalog/MasterCatalogBrowser.tsx`
- edit `src/routes/admin.price-books.tsx`
- edit admin sidebar component (label only)