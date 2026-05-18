## Goal

Per-estimate toggle that hides qty + per-line pricing (showing only item names) and replaces the auto-calculated total with a manually-entered amount you control.

## Changes

### 1. Database
Add two nullable columns to `estimates`:
- `manual_total numeric` — your override amount
- `use_manual_total boolean default false` — whether the override is active

(`hide_pricing` already exists.)

### 2. Estimate page — Totals panel
In the right-hand totals card:
- Keep the existing "Hide pricing" toggle, relabel to **"Hide qty & pricing on PDF"** so it's clear it removes Qty too.
- Add a **"Use manual total"** toggle. When on:
  - A single money input appears: **"Customer total $ ____"**.
  - The Subtotal / Markup / Overhead / Profit / Tax rows are hidden (or shown collapsed/greyed) — the calc is no longer in effect for this estimate.
  - The Grand Total row at the bottom shows your entered number.
- Both toggles + the manual amount save with the existing debounced estimate save.
- `jobs.total_estimate` sync uses `manual_total` when the toggle is on, otherwise the calculated total.

### 3. PDF / Report page
For each estimate where the toggle is on:
- In the Investment table, drop the **Qty**, **Unit**, **Price**, and **Total** columns when `hide_pricing` is true, leaving just the item name list.
- Skip the Subtotal / Markup / Overhead / Profit / Tax breakdown block when `use_manual_total` is true.
- Show a single bold **Total** row with `manual_total`.

When `use_manual_total` is off, the report behaves exactly as today.

### 4. Per-estimate scope
All three flags (`hide_pricing`, `use_manual_total`, `manual_total`) live on each `estimates` row, so Good / Better / Best each have their own independent setting and total.

## Technical notes

- Migration adds the two columns nullable; no RLS change needed (inherits existing policies).
- Local `EstimateRow` type in `src/routes/_app.jobs.$id.estimate.tsx` extended with the new fields; debounced save patches them on the estimate row.
- `EstimateTotalsPanel.tsx` accepts the two new values + change handler; renders the manual-total UI conditionally.
- `_app.jobs.$id.report.tsx` reads `use_manual_total` / `manual_total` / `hide_pricing` from each estimate when rendering the Investment section.
- The estimate **builder** table (`LineItemTable.tsx`) is unchanged — you still see and edit qty/price; only the customer-facing PDF is stripped.

## Out of scope

- Hiding qty/pricing inside the in-app builder.
- Order form / labor work-order pricing (separate area, handled previously).
