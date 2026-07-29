## What I found (verified against the database)

- The upload actually worked. `price_books` has three master markets: **South Florida (4,659 prices)**, **Chicago (4,659)**, and an older **Dallas (808)**. `line_item_master` holds 10,048 master items across all 8 trades.
- **Why the Pricing page shows 0 items:** `line_item_prices` has **no foreign key** to `line_item_master` (only a primary key). The Pricing page and the admin market detail both use an embedded join (`line_item_master:line_item_master_id(...)`), which the data API rejects without a foreign key — so the query errors out and the table renders "No items match your search" even though the book reports 4,659 items.
- **Why the catalog/estimate picker looks like old pricing:** every catalog query is unpaginated, and the data API caps responses at 1,000 rows. That's exactly why the Master Catalog says "1000 items · 3 trades" and the estimate picker only lists a few hundred per trade. The estimate picker also falls back to `line_item_master.default_price` (the old seeded price) whenever a market price isn't in that truncated 1,000-row slice.
- **Why estimates don't use the new books:** only Global Contractor Network has `default_market_id` set (South Florida). Free Bird Roofing Group, Advantex, and QA Test Co have **no market selected**, so price resolution falls through to a generic master default.

## The fix

**1. Database migration**
- Add the missing foreign keys: `line_item_prices.line_item_master_id → line_item_master(id)` (on delete cascade) and `line_item_prices.price_book_id → price_books(id)` (on delete cascade), plus supporting indexes. This alone makes the Pricing page and the admin market view load.
- Clean up orphan rows first if any exist, so the constraint applies cleanly.
- Retire the stale Dallas 808-item book (deactivate rather than delete, so nothing breaks).

**2. Paginate every catalog/price read** (removes the silent 1,000-row cap)
- `src/components/pricing/SelectedMarketView.tsx` — fetch all market prices in 1,000-row pages.
- `src/components/catalog/MasterCatalogBrowser.tsx` — same, so all 10,048 master items show.
- `src/components/estimate/AddLineItemCombobox.tsx` — page both the catalog fetch and the market-price fetch, and drop the `.in(ids)` filter in favor of fetching the whole book by `price_book_id`.
- `src/lib/markets.functions.ts` (`getMarketDetail`) — page the server-side read too.

**3. Make market prices authoritative in estimates**
- In `AddLineItemCombobox`, when a market price book is resolved, use the market's `unit_price`/`remove_price` as the price and only fall back to `default_price` when the item genuinely has no market row (currently any zero-or-missing lookup silently reverts to old pricing).
- Show the resolved market name in the picker header so it's obvious which book is in play.

**4. Assign markets to companies**
- Set `default_market_id` for Free Bird Roofing Group (South Florida, matching their service area) and Advantex, so their estimates resolve to the new books instead of a generic fallback.
- Keep the existing "Change market" picker for switching between South Florida and Chicago.

## Technical notes

- The missing FK is the root cause of the empty table; PostgREST resource embedding requires a declared relationship, and the client currently swallows that error into an empty list.
- Pagination will use `.range(offset, offset + 999)` loops; 4,659 prices = 5 requests, 10,048 catalog items = 11 requests, both cached by React Query.
- No changes to RLS are needed — the existing "View prices for accessible price books" policy already allows reading master (`company_id IS NULL`, `is_default = true`) books.

## Open question

For Free Bird I'll default them to **South Florida**. Tell me if they should be on Chicago instead, or if you want the market auto-picked from the job's ZIP code rather than a company-wide setting.
