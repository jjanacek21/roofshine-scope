## Goal

Replace the existing 310-item catalog with the new Xactimate-grouped dataset (FLJU8X_APR26), add `domain` + `subgroup` hierarchy, and rebuild the macro builder + estimate item picker around filterable group/sub-group navigation.

## What to build

### 1. Schema changes (one migration)

Add hierarchy + costing columns to `line_item_master`:
- `domain text` — top-level bucket from your CSV (e.g. "Roofing", "Windows")
- `subgroup text` — material/system bucket (e.g. "Concrete Tile", "Asphalt Shingles", "Flashings")
- `xactimate_prefix text` — RFG, WDA, DOR, …
- `trade_name text` — official Xactimate trade name
- `hours numeric` — labor hours per unit
- `material_cost numeric` — material $ per unit
- `price_book_code text` — e.g. "FLJU8X_APR26"

Indexes on `(domain, subgroup)` and `code` for fast filtering/search.

Wipe the old 310 items + their `master_macro_items` references (macros table is empty already, so no orphan cleanup needed there).

### 2. CSV ingest

You'll paste CSV chunks in chat. I'll:
1. Concatenate all chunks into one CSV.
2. Parse + validate (every row needs `code`, `domain`, `subgroup`).
3. Map each row's `domain` → existing `trade` enum (Roofing→roofing, Windows→windows, etc.) so the existing trade colors/badges keep working.
4. Bulk-insert into `line_item_master` with `company_id = NULL` (master catalog).
5. Report counts per (domain, subgroup) so you can verify nothing was miscategorized.

### 3. New macro builder UI (`/admin/macros` — replace existing editor)

Two-pane layout:
- **Left**: collapsible tree — Domain → Subgroup → line items with checkbox per item. Search box at top filters the tree live.
- **Right**: "Selected items" list with qty + qty_mode (manual / auto-count / fixed) per item, drag to reorder, save button.
- Macro header still has name, description, asset_type (for AI matching), is_addon.

Bulk actions: "Select all in subgroup", "Clear selection".

### 4. Estimate-side line item picker (rewrite `AddLineItemCombobox`)

Wider popover with:
- Search bar at top (debounced, searches code/name/description across whole catalog).
- When search is empty: show Domain → Subgroup tree; clicking a subgroup lists its items on the right.
- When search has text: flat results grouped by subgroup.
- Each result row: code, name, unit price, unit, "+ Add" button.

### 5. AI photo-matching alignment

Update `api.auto-add-photo-suggestions` and `api.analyze-job-photos` prompts so they reason in (domain, subgroup) terms — "this is a tile roof, pull all items from Roofing→Concrete Tile + Roofing→Underlayment & Felt + Roofing→Flashings as needed". This is what unlocks the "stop suggesting 38 duplicates" outcome you flagged earlier: the AI picks subgroups, then macros bring in the standard line items.

## Technical notes

```text
domain (Roofing)
  └─ subgroup (Concrete Tile)
       └─ line_item_master rows (code, name, unit, default_price, hours, material_cost)
```

- `trade` enum stays as-is (used everywhere for colors). `domain` is a free-text superset that maps onto it.
- `default_price` will be set to `material_cost + (hours * assumed_labor_rate)` OR left at 0 and computed at insert time — confirm during ingest.
- RLS unchanged (master catalog rows have `company_id = NULL`, already readable by everyone).

## Out of scope (for this pass)
- Importing per-region price books beyond FLJU8X_APR26 (schema supports it via `price_book_code`, UI later).
- Migrating any existing custom company line items — there are none right now (all 310 are master rows being replaced).

## Order of work
1. Migration (schema + wipe).
2. Wait for CSV chunks → ingest script → bulk insert → verification report.
3. New macro builder UI.
4. New estimate picker.
5. AI prompt updates.

Ready to start once you paste the CSV.