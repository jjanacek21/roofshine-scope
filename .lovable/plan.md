## Goal

When a new admin onboards and creates a company on `/onboarding`, let them pick which **market price list** (e.g. South Florida) the company should use by default. Today they get nothing until a super admin assigns one.

## Background

- Markets = rows in `price_books` where `company_id IS NULL AND is_default = true` (`listMarkets` in `src/lib/markets.functions.ts`).
- `resolvePriceBook` already falls back to master/default books when a company has no matching book — but it picks by ZIP/jurisdiction, not by the company's stated preference. We need an explicit "this is my company's market" pointer.
- The `companies` table has no column for this today.

## Changes

### 1. Database (migration)
- Add column `companies.default_market_id uuid NULL` referencing `price_books(id)` `ON DELETE SET NULL`.
- No RLS changes needed (existing company policies cover it).

### 2. Server function — public market list for onboarding
Add `listMarketsPublic` in `src/lib/markets.functions.ts`:
- Uses `requireSupabaseAuth` (any authenticated user), no super-admin check.
- Returns `{ id, name, region_name, jurisdiction, item_count }` for every `price_books` row with `company_id IS NULL AND is_default = true AND is_active = true`, ordered by `region_name`.
- (`listMarkets` stays super-admin-only for the admin UI.)

### 3. Onboarding UI — `src/routes/onboarding.tsx`
In the "Create company" form:
- Fetch markets via `useServerFn(listMarketsPublic)` + `useQuery` on mount.
- Add a "Price list / Market" `<select>` (or styled radio cards) above the markup row.
  - Placeholder option: "Choose a market…"; required.
  - Each option shows `region_name` (or `name`) + small "(N items)" hint.
  - If only one market exists, preselect it.
  - If zero markets exist, show a muted note ("No master price lists available yet — your admin can add one later") and allow finishing without one.
- On submit, include `default_market_id` in the `companies` insert.

### 4. Wire it into price-book resolution — `src/lib/resolve-price-book.ts`
In `resolvePriceBook`, when no company-specific book wins:
- If the company has a `default_market_id`, prefer that master book over generic ZIP/jurisdiction matches on other master books (score bump, reason: `"Company's chosen market (<name>)"`).
- Load the company row once at the top to read `default_market_id` (single extra `select` keyed by `companyId`).

### 5. Admin can change it later
- On `src/routes/admin.companies.$id.tsx` (existing company detail page), add a "Default market" dropdown bound to the same `listMarkets` data so super admins can switch it post-onboarding. Small addition, same select component.

## Out of scope
- Bulk-copying market prices into a brand-new company-specific book (resolution already falls through to the master book, so this is unnecessary for pricing to work).
- Changing the Markets admin page UI.
- Per-user market overrides.

## Files touched
- migration (new): add `companies.default_market_id`
- `src/lib/markets.functions.ts` — add `listMarketsPublic`
- `src/routes/onboarding.tsx` — market picker + insert payload
- `src/lib/resolve-price-book.ts` — prefer company's chosen market
- `src/routes/admin.companies.$id.tsx` — admin-side editor for the field
