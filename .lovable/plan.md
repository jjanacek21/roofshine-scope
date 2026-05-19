The 3 CSVs you uploaded don't match what the current ingest code expects. They share columns:

`item_number, description, qty, unit, remove, replace, tax, total, trade, sub_group, price_list, region`

867 rows each. `item_number` is consistent across files (row 1 = "Contents - move out then reset" in all 3), so it works as the catalog code. `description` is identical across files. Only `remove` and `replace` prices change per market. Region/price_list IDs are embedded in the file (`FLFL8X`, `TXDF8X`, `ILCC8X`).

The current code expects a single `unit_price` column and a `code` column — neither exists. It would silently fail or fall back to junk data. Plan below fixes it.

## 1. Schema tweak

Add a column to `line_item_prices` so each market can store both a removal price and a replacement price (right now there's only `unit_price`):

```text
ALTER TABLE line_item_prices ADD COLUMN remove_price numeric DEFAULT 0;
-- existing unit_price column will hold the "replace" price
```

`line_item_master` already has `remove_price`, `replace_price`, `subgroup` columns we can populate as defaults from the first market.

## 2. CSV header mapping (rewrite `MarketUploadDialog.tsx` parser)

| CSV column     | Destination                                            |
|----------------|--------------------------------------------------------|
| `item_number`  | `line_item_master.code` (zero-padded, e.g. `0001`)     |
| `description`  | `line_item_master.name` + `description`                |
| `unit`         | `line_item_master.unit`                                |
| `trade`        | normalize → `trade_type` enum (Drywall & Insulation → `interior`, Roofing → `roofing`, etc.) |
| `sub_group`    | `line_item_master.subgroup` + `category`               |
| `remove`       | `line_item_prices.remove_price`                        |
| `replace`      | `line_item_prices.unit_price` (the "replace" price)    |
| `qty`, `tax`, `total`, `price_list`, `region` | ignored (computed at estimate time) |

Add a trade-name normalizer with this map (covers all values seen in the CSVs):

```text
Contents, Site Protection, Drywall & Insulation, Painting,
Cabinetry, Flooring, Doors, Windows, Cleaning, Demolition,
Framing & Rough Carpentry, Finish Carpentry / Trimwork,
Tile, Stairs → "interior"
HVAC → "hvac"
Electrical → "electrical"
Plumbing → "plumbing"
Roofing → "roofing"
Siding, Stucco, Exterior → "exterior"
Water/Fire/Mold/Mitigation → "mitigation"
(unknown → "interior")
```

We'll surface the inferred trade in the preview table so you can spot-check before committing.

## 3. Ingestion logic (`ingestMarketCsv`)

1. Load existing master catalog keyed by `code` (= `item_number`).
2. For codes not yet present, insert into `line_item_master` with: name, unit, trade, subgroup/category, description, `default_price` = replace, `remove_price`, `replace_price`. This makes the FIRST CSV the seed.
3. For each row, write/upsert one `line_item_prices` row for this market with `unit_price = replace`, `remove_price = remove`.
4. Skip rows where both `remove` and `replace` are 0/empty (some are placeholder lines).
5. Update `price_books.item_count` and `effective_month` (parse `02MAY26` → 2026-05-01).

## 4. Region auto-naming

Pre-fill region metadata from `region` column on first upload:

| Region code | Suggested name        | Jurisdiction |
|-------------|----------------------|--------------|
| `FLFL8X`    | Florida              | FL           |
| `TXDF8X`    | Dallas–Fort Worth    | TX           |
| `ILCC8X`    | Chicago Cook County  | IL           |

You can edit the names and add ZIPs after upload — the upload dialog will pre-fill region_name when creating a new market.

## 5. UI: where remove vs replace shows up

- **Markets tab → market detail**: table now has columns `Code | Description | Unit | Remove | Replace | Trade`.
- **Master Catalog tab**: shows item with replace as the headline price; remove shown in a smaller subline.
- Estimating flow uses `replace` by default (current behavior). A later pass can let line items toggle to "remove only" or "remove + replace" — flagging that as out of scope for this turn.

## 6. Files touched

- `supabase/migrations/…` — add `remove_price` to `line_item_prices`.
- `src/lib/markets.functions.ts` — rewrite `IngestRowSchema` + `ingestMarketCsv`.
- `src/components/markets/MarketUploadDialog.tsx` — new header mapper, trade normalizer, preview columns.
- `src/components/markets/MarketsTab.tsx` — show remove/replace in detail view; auto-fill region name from CSV `region` column.

## What I need confirmed

1. Treat `replace` as the headline "unit price" everywhere outside the market detail view — OK?
2. Skip rows where both remove and replace are 0 (≈ blank template rows) — OK?
3. Trade mapping above — anything you want re-routed (e.g. "Contents" → its own enum value)?
