## Goal

When a company admin clicks **Pricing**, they should see ONE selected market (price book) with its 808 line items — not a list of all master books. They can switch markets if needed, but estimates always pull from the single selected market.

## Changes

### 1. `src/routes/_app.price-books.tsx` — rebuild the Insurance tab

Replace the "list every master + company book" table with a **single-market view**:

- Read `companies.default_market_id` for the current company via `useCompany()` (or a small `useQuery` on the companies row).
- If set → show one header card: market name, jurisdiction, ZIP count, items count, effective month, "Active" status, and a **"Change market"** button.
- If unset → show an empty-state card with a **"Choose a market"** picker (same dropdown shape as onboarding's `listMarketsPublic`).
- Below the header, render the **line items** for the selected market (paginated/searchable table from `line_item_prices` joined with `line_item_master`, similar to `MasterCatalogBrowser` but read-only for non-admins). Group by trade → subgroup, matching the master catalog grouping the user already approved.
- Remove the "Active Books / Last Reprice / Total Items Priced" 3-card strip and the all-books table — replace with a single "Selected Market" summary.
- Keep the **Retail Pricing** tab unchanged.
- Hide the "Upload Xactimate Book" button for non-super-admins (it currently shows for everyone). Super admins still manage uploads in `/admin/price-books`.

### 2. Change-market action

- Clicking "Change market" opens a small dialog/select listing all active master price books (via existing `listMarketsPublic`) with item counts.
- On confirm: update `companies.default_market_id` (admins/owners only — RLS already restricts company updates). Invalidate the price-books query.
- Non-admin team members see the market read-only (no "Change market" button).

### 3. No DB changes required

The `companies.default_market_id` column already exists from the prior migration. `resolvePriceBook` already prefers it. No new tables or columns.

### 4. Out of scope

- No changes to `/admin/price-books` (super-admin master catalog view stays as-is).
- No change to estimate-time resolution — `resolvePriceBook` already prefers `default_market_id`.
- Retail tab unchanged.
- No bulk-copy of market prices into a company-specific book.

## Files touched

- `src/routes/_app.price-books.tsx` — Insurance tab rewrite + change-market dialog
- (Possibly) a small new `src/components/pricing/SelectedMarketView.tsx` for the items table, to keep the route file readable

## Open question

When a company has no `default_market_id` set yet (existing companies from before the onboarding picker), should I:
**(a)** auto-pick the first active master market and save it, or
**(b)** force the admin to choose on first visit (empty state + picker)?

I'd recommend **(b)** — explicit choice avoids surprising defaults.
