## What's changing

Switch the Master Catalog browser from grouping by `domain` (all null → "Other") to grouping by `trade` with `subgroup` as the second level, using the canonical trade list and colors from `src/lib/trades.ts`.

## Why the "0 items" on the South Florida card

The first upload failed at the duplicate-key step *after* seeding the catalog but *before* writing prices. The dedupe fix already shipped, so the next upload will populate `line_item_prices` and the card count will jump from 0 to ~865. No code change needed there — just re-upload the SF CSV.

## Files touched

**`src/components/catalog/MasterCatalogBrowser.tsx`** — only file edited.

1. Change the query `.select` to include `trade` (already in the table; `domain` is null and useless).
2. Build the tree as `Map<trade, Map<subgroup, Item[]>>`.
3. Render trade nodes in the order defined by `TRADES` in `src/lib/trades.ts` (roofing, exterior, windows, interior, hvac, plumbing, electrical, mitigation), using `getTradeLabel()` for the display name and a colored dot using `getTradeColor()` next to each trade row.
4. Sort subgroups alphabetically within each trade. Items with no subgroup fall into an "Uncategorized" bucket at the bottom of that trade.
5. Update the right-pane "Domain / Subgroup" column header and cell to "Trade / Subgroup" using the trade label + color dot.
6. Update the header stat from "N domains" to "N trades".
7. Search continues to match code/name/subgroup/trade-label.

## What it'll look like

```
ROOFING            333
  ├ Asphalt Shingles     74
  ├ Concrete/Clay Tile   41
  ├ Flashing             28
  ├ Hardware             12
  ├ Metal                33
  ├ Underlayments        19
  ├ Ventilation          16
  └ Uncategorized       110
EXTERIOR            70
INTERIOR           326
WINDOWS & DOORS     60
ELECTRICAL          31
HVAC                26
WATER/MOLD MITIG.   19
```

(Subgroup names come straight from whatever the SF CSV's `sub_group` column carried during the first ingest — the trade-side breakdown is the structural change; subgroup labels stay verbatim from the CSV.)

## Not in scope

- Renaming/normalizing subgroup labels (e.g. merging "Asphalt Shingle" vs "Asphalt Shingles") — flag once we see them rendered, easy follow-up.
- Per-trade icons (sticking to a colored dot — keeps the tree compact).
- Markets card count fix — already handled by the dedupe fix; re-upload SF and it'll show ~865.