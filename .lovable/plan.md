## Goal
Admins of new companies can (1) bulk-upload their own material price list via CSV and (2) edit a standalone list of per-task / per-square labor rates — instead of being stuck on the Global Contractor Network defaults.

## 1. Material price-list CSV upload

Location: `Settings → Materials → Material Catalog` tab, new "Upload CSV" button next to the search bar.

Flow:
- Admin clicks **Upload CSV** → dialog opens with a "Download template" link.
- CSV columns: `category, name, sku, uom, unit_price, coverage_sq, notes` (category = slug like `shingles`, `underlayment`, etc; matches existing `material_categories.slug`).
- Parse client-side with PapaParse; validate with zod (max 5,000 rows, price ≥ 0, required fields).
- Preview table: shows row count, # new vs. # updated (matched on `slug` within the same category for the company), # rows skipped with reasons.
- Confirm → batch inserts/updates into `material_catalog` scoped to `company_id`, auto-creating company-specific `material_categories` rows when the slug exists only as a global.
- Toast + invalidate `["material_catalog"]`, `["material_categories"]`.

No schema changes — `material_catalog` already supports per-company rows; RLS already restricts to `auth_company_id()`.

Add `papaparse` dependency.

## 2. Standalone Labor Rates tab

Add a new top-level tab in `_app.settings.tsx`: **Labor**.

New table `company_labor_rates`:
- `id uuid pk`, `company_id uuid not null`, `task text not null`, `uom text not null` (sq, hr, ea, lf), `rate numeric(10,2) not null`, `sort_order int default 0`, `notes text`, `active bool default true`, `created_at`, `updated_at`.
- Unique `(company_id, lower(task), uom)`.
- RLS: select for company members; insert/update/delete restricted to `is_company_admin()`; super_admin full access.

Seed helper: a "Load starter rates" button (mirrors the Rules tab pattern) that inserts a canonical set (Tear-off /sq, Install shingles /sq, Underlayment /sq, Drip edge /lf, Pipe boot /ea, Step flashing /lf, Ridge cap /lf, Valley /lf, Crew hourly /hr, Foreman hourly /hr).

UI (matches existing Materials tab visual language):
- Editable table: Task | UOM | Rate | Notes | Actions (edit / delete).
- Inline-add row at the bottom.
- Non-admins see read-only.

Optional follow-up (not in this plan): wire `company_labor_rates` as autocomplete suggestions inside `template_labor_lines` editor and into the order-form labor section. Out of scope here so we don't touch estimate logic.

## Files

```text
NEW  supabase migration            — company_labor_rates table + RLS + updated_at trigger
NEW  src/lib/labor-rates.ts        — types + starter-rate seed list
NEW  src/components/settings/LaborRatesTab.tsx
NEW  src/components/settings/MaterialCsvUploadDialog.tsx
EDIT src/routes/_app.settings.tsx  — add "Labor" tab, mount LaborRatesTab
EDIT src/components/settings/MaterialsTemplatesTab.tsx — add "Upload CSV" button + mount dialog
DEP  bun add papaparse @types/papaparse
```

## Out of scope
- Xactimate-style PDF import (existing parser stays admin-only at `/admin/price-books`).
- Replacing the per-row override flow — CSV is additive.
- Auto-applying labor rates to existing roof templates / estimates.
