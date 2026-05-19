## Goal

Replace the current master pricing setup with a clean model:

- **One master catalog** of ~800 line items (shared rows, no duplication)
- **Markets** = named regions with ZIPs (e.g. "South Florida" / 33xxx ZIPs)
- Each market holds only its **unit_price overlay** for every catalog item
- Admin can upload a CSV per market, delete a market, and organize them by area

The DB already has the right shape (`line_item_master` + `price_books` + `line_item_prices`). We just wipe the old data, repurpose `price_books` as "markets", and rebuild the admin UI + upload flow.

---

## Step 1 — Wipe existing pricing data (migration)

```text
DELETE FROM line_item_prices;
DELETE FROM company_macro_pricing;
UPDATE estimate_line_items SET line_item_id = NULL;  -- preserves historical estimates
DELETE FROM price_books;
DELETE FROM line_item_master;
```

Existing jobs/estimates keep their snapshotted line totals; they just lose the FK back to catalog rows (which is what `ON DELETE SET NULL` already expects).

## Step 2 — Light schema additions

Add to `price_books`:
- `region_name TEXT` — human label ("South Florida")
- already has `zip_codes TEXT[]` and `jurisdiction` — reuse

Add a `master_markets` view convention: a master "market" = `price_books` row where `company_id IS NULL AND is_default = true`.

No new tables needed.

## Step 3 — CSV upload flow (admin)

New page section: **`/admin/price-books` → Markets tab**

Upload UX:
1. Admin clicks **"Upload Market Price List"**
2. Picks/creates a market: name + ZIP codes (comma/space separated, e.g. `33101, 33102, 33125`)
3. Drops a CSV with columns auto-detected: `code, description, unit, unit_price` (+ optional `trade`, `category`)
4. Preview shows: "X new catalog items will be created · Y existing items will get prices for this market"
5. Confirm → server function runs:
   - Upsert catalog rows into `line_item_master` (match by `code`, `company_id IS NULL`)
   - Insert/update `line_item_prices` rows for this market's `price_book_id`

The first CSV seeds the catalog; the other two only attach prices to existing codes. Any code that appears in a later CSV but not the first is added to the catalog at that point.

Implemented as a `createServerFn` (`ingestMarketCsv`) that uses `supabaseAdmin` and is gated by `is_super_admin()`.

## Step 4 — Admin UI rework on `/admin/price-books`

```text
┌─ Master Catalog & Markets ────────────────────────┐
│  [ Catalog ]  [ Markets ]  [ Macros ]             │
├───────────────────────────────────────────────────┤
│ CATALOG TAB                                       │
│  Search / filter by trade · category              │
│  Table: code | name | unit | trade | # markets    │
│         priced | row actions (edit / archive)     │
│                                                   │
│ MARKETS TAB                                       │
│  + Upload Market Price List                       │
│  ┌───────────────────────────────────────────┐    │
│  │ South Florida   812 items   Edit  Delete  │    │
│  │ ZIPs: 33xxx (47)                          │    │
│  ├───────────────────────────────────────────┤    │
│  │ Central Florida 812 items   Edit  Delete  │    │
│  │ Tampa Bay       812 items   Edit  Delete  │    │
│  └───────────────────────────────────────────┘    │
└───────────────────────────────────────────────────┘
```

- **Edit market** → rename, change ZIPs, re-upload CSV (replaces all prices for that market)
- **Delete market** → drops the `price_books` row + cascades `line_item_prices`; catalog stays
- Each market card links to a detail page listing every catalog item with that market's unit price (inline editable)

## Step 5 — Job resolution (already exists)

`src/lib/resolve-price-book.ts` already picks the right master book by ZIP / jurisdiction. After the rewrite it just works: a job in 33101 → South Florida prices; 33614 → Tampa Bay prices.

## Step 6 — CSV ingestion order

You'll upload 3 CSVs. I'll need to know the **column header names** in your CSVs. Standard expected:

```text
code,description,unit,unit_price
RFG240,Laminated comp shingles,SQ,285.50
...
```

Optional columns honored if present: `trade`, `category`, `waste_pct`. Anything else is ignored. I'll show a preview before insert so we catch mismatches.

---

## Technical notes

- DB migration: schema additions + data wipe (single migration, requires your approval)
- New file: `src/lib/markets.functions.ts` — `listMarkets`, `upsertMarket`, `deleteMarket`, `ingestMarketCsv`
- New file: `src/routes/admin.markets.tsx` (or replace the existing Markets tab content in `admin.price-books.tsx`)
- New component: `src/components/markets/MarketUploadDialog.tsx` (CSV parse with `papaparse`)
- Reuses existing RLS: super admins manage; company members read-only via `is_default = true` master books
- Estimate FKs use `ON DELETE SET NULL`, so the wipe is non-destructive to historical jobs

---

## What I need from you to proceed

1. Approve this plan
2. Confirm the 3 market names + ZIP groupings (e.g. South FL / Central FL / Tampa Bay)
3. Share the 3 CSVs (or just the headers of one) so I can verify the column mapping before I write the parser

Then I run the wipe migration, build the UI + upload flow, and we ingest the 3 CSVs together.
