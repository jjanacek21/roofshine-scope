

## Goal

Remove the **Catalog** tab from the app and consolidate everything pricing-related under **Pricing**.

## What changes

### 1) Remove the Catalog nav item
- Remove the "Catalog" link from `src/components/layout/AppSidebar.tsx`.
- Remove the "Catalog" link from `src/components/layout/MobileBottomTabs.tsx` (if present).
- Remove any "Catalog" reference in `src/components/layout/Topbar.tsx` (page-title map).

### 2) Retire the `/catalog` route
- Delete `src/routes/_app.catalog.tsx`.
- The TanStack router will regenerate `routeTree.gen.ts` automatically — no manual edit needed.
- Any internal `<Link to="/catalog">` usages get rerouted to `/price-books` (Pricing). I'll grep for those and update them.

### 3) Make sure no functionality is lost
- The Catalog page was a read-only view of `line_item_master` rows. That data is already surfaced inside the Pricing flows (Insurance library + Retail macros + estimate line-item picker via `AddLineItemCombobox`), so nothing user-facing is lost.
- If we discover the Catalog page had unique filters worth keeping (e.g. browse-all-codes), I'll fold a "Browse all line items" view into the Pricing page as a third sub-section. Default plan: just remove it.

## Files touched

- **Edited**: `src/components/layout/AppSidebar.tsx`, `src/components/layout/MobileBottomTabs.tsx`, `src/components/layout/Topbar.tsx`, plus any file referencing `/catalog`.
- **Deleted**: `src/routes/_app.catalog.tsx`.
- **Auto-regenerated**: `src/routeTree.gen.ts`.

## Out of scope

- No database changes — `line_item_master` stays exactly as it is; it powers Pricing and the estimate item picker.
- No changes to admin routes.

