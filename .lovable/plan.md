

## Root cause

When you click "Upload estimate file" on the admin Pricing page, the URL changes to `/admin/price-books/new` but the page content doesn't change. Same bug exists on the company-side `/price-books` page.

**Why**: TanStack Router treats `admin.price-books.new.tsx` as a **child route** of `admin.price-books.tsx` (because both files share the same prefix). When you navigate to the child URL, both routes match — but the parent route's component (`AdminPricing`) doesn't render an `<Outlet />`, so the child component (`NewMasterPriceBookPage`) is never displayed. URL updates, screen doesn't.

The exact same issue affects the company-side route: `_app.price-books.tsx` is missing an `<Outlet />` for `_app.price-books.new.tsx`.

## Fix

In **both** parent route files, render the list/tabs UI **only when the URL is exactly the parent path**, otherwise render `<Outlet />` so the child page (the upload wizard) takes over the screen.

### File 1: `src/routes/admin.price-books.tsx`
- Import `Outlet` and `useMatchRoute` from `@tanstack/react-router`.
- Inside `AdminPricing`, detect whether a child route is currently matched.
- If a child is matched → render `<Outlet />`.
- Otherwise → render the existing tabs + list UI as today.

### File 2: `src/routes/_app.price-books.tsx`
- Same pattern: add `<Outlet />` and only render the page's own content when no child route is active.

## Result

- Click **Upload estimate file** on the super-admin Pricing page → wizard appears, you drop your Xactimate PDF, line items get extracted, name auto-fills, you save.
- Same fix unblocks the company-side `/price-books/new` upload flow at the same time.

## Out of scope

- No changes to the wizard itself — `admin.price-books.new.tsx` and `_app.price-books.new.tsx` are correct.
- No changes to the PDF extraction endpoint (`/api/parse-xactimate-pdf`) or the parser.
- No DB or schema changes.

