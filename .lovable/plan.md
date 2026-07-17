## Goal

Move the SPF Calculator's hardcoded data (products, details, stacks, field defaults) into the database, add an admin backend under `/admin` to manage it, and add a Simple / Detailed toggle whose visible fields are admin-configurable.

Prices remain **global** (single master library owned by Roof King / Global Contractor Network admins). Every company using the calculator reads the same catalog.

## What to build

### 1. Database (single migration)

New tables in `public`, all admin-writable, all readable by any authenticated user:

- `spf_products` — name, solids_pct, cost_per_gal, default_mils, default_method, role, sort_order, active
- `spf_details` — label, unit (`ea|lf|ls`), default_qty, unit_cost, sort_order, active
- `spf_stacks` — key, label, sort_order, active
- `spf_stack_layers` — stack_id fk, product_id fk, scope, amount, method, mils, sort_order
- `spf_field_defaults` — one row per field key (`p_sqft`, `m_margin`, …) with `value_text`, `label`, `group` (project/existing/access/foam/…), `simple_mode` bool, `sort_order`
- `spf_calc_settings` — singleton row: default simple/detailed mode, any global toggles

Grants + RLS: `SELECT` for `authenticated`; `INSERT/UPDATE/DELETE` gated by `is_super_admin()` (or existing admin helper). Seed with the current contents of `src/lib/spf/data.ts` verbatim so nothing changes on day one.

### 2. Data loading refactor

- New `src/lib/spf/catalog.functions.ts` — `getSpfCatalog()` server fn returns `{ products, details, stacks, fieldDefaults, settings }`.
- `SPFCalculator.tsx` fetches via `useSuspenseQuery`; keep current in-memory shape by mapping DB rows into the existing `Product`/`Detail`/`StackTemplate` tuples so `engine.ts` and `presets.ts` stay untouched.
- Presets keep referencing product indexes; resolve by product id server-side so reorders don't break them.

### 3. Admin backend — `/admin/spf`

New route `src/routes/admin.spf.tsx` (gated by existing admin layout). Four tabs:

- **Products** — table + inline edit dialog (name, solids%, $/gal, mils, method, role, active).
- **Details catalog** — table + edit dialog (label, unit, default qty, unit-cost, active).
- **Stacks** — list of presets; each opens a layer editor (add/remove layers, pick product, scope, amount, method, mils).
- **Field defaults & modes** — grouped list of every field with: default value, "show in Simple mode" toggle, label override.

All mutations go through admin-only server fns in `src/lib/spf/catalog-admin.functions.ts` using `requireSupabaseAuth` + role check, then `supabaseAdmin` for writes.

### 4. Simple / Detailed toggle in the calculator

- Toggle in the SPF Calculator header: **Simple | Detailed** (default from `spf_calc_settings`, persisted per user in `localStorage`).
- Detailed = current 10-panel UI (unchanged).
- Simple = renders only fields whose `simple_mode = true` in `spf_field_defaults`, grouped by section; sections with zero visible fields are hidden. Engine still runs on the full field set (hidden fields use their defaults), so totals stay accurate.

### 5. Nav

Add "SPF Calculator" entry to the admin sidebar (`src/components/layout/AppSidebar.tsx`, admin section) linking to `/admin/spf`.

## Out of scope

- Per-company overrides (explicitly global per your answer).
- Changes to engine math, presets math, or the Roof King → SPF Calculator route.
- Materials/labor pricing outside the SPF calculator (existing Master Catalog / labor-rates tabs handle those for the wider app).
