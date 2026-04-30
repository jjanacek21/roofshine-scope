## Goal
Populate `default_price` (and capture remove/replace pricing) for all 428 master catalog items in `line_item_master` using the uploaded `xactimate_full.csv`.

Today only 72 / 428 items have a non-zero price — the original CSV import dropped the price columns. The new file has `replace_price`, `remove_price`, and `rr_total` per code.

## Pricing rule
For each item, set `default_price` to:
- `rr_total` if present (this is the total Remove & Replace cost — the realistic full-job unit price), else
- `replace_price` as fallback.

`rr_total` is correct for line items used in restoration estimates (it already includes the demo/removal labor on top of the install). 427 / 428 rows have it.

## Schema additions (small migration)
Add two nullable numeric columns to `line_item_master` so we don't lose the breakdown:
- `remove_price numeric` — labor to tear out / dispose
- `replace_price numeric` — material + install only

These let the estimate UI later offer "install only" vs "R&R" without re-importing.

## Data update
1. Copy `/tmp/xactimate_full.csv` into a temp staging table via `psql COPY`.
2. `UPDATE line_item_master` joining on `code` where `company_id IS NULL`:
   - `default_price = COALESCE(rr_total, replace_price, default_price)`
   - `remove_price = csv.remove_price`
   - `replace_price = csv.replace_price`
3. Report back: rows matched, rows unmatched, before/after price coverage, sample of top & bottom priced items.

## What I will NOT change
- `hours` and `material_cost` stay as-is (CSV doesn't include them; they'll be revisited later).
- No UI changes needed — the existing `MasterCatalogBrowser` already reads `default_price` and will immediately show the new prices.
- No company-level pricing (`company_macro_pricing`) is touched.

## Verification step
After the update, I'll run a quick query showing:
- count of items with `default_price > 0` (should jump from 72 → ~427)
- any codes in CSV that didn't match a catalog row (so we can investigate)
- any catalog rows still at $0 after the update
