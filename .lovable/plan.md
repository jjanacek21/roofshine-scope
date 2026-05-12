## Order Form Generator — Job Workflow Tab

Add a new **"Order Form"** tab to the job workflow (between Estimate and Contract) that contractors use to pre-cap roofs, generate crew work orders, and generate supplier POs from a stored material catalog and reusable roof-system templates.

Note: you said "lead workflow" but the Contract tab lives in the **job** workflow (`/jobs/$id/...`). The new tab will sit there. Confirm if you actually meant the lead detail sheet.

### Tab placement
`Overview · Measurements · Photos · Estimate · ` **`Order Form`** ` · Contract · Report`

Route: `src/routes/_app.jobs.$id.order-form.tsx`

### Database (new tables, all RLS-scoped via `auth_company_id()`)
- `material_suppliers` — supplier + rep contact
- `material_categories` — 16 seeded categories (shingles, hip_ridge, starter, underlayment_mech, underlayment_sa, low_slope, tile, metal, ventilation, pipe_flashing, fasteners, adhesives, skylights, wood, gutters, delivery)
- `material_catalog` — ~120 SKUs seeded from the SRS 5/01/2026 pricelist in your prototype
- `roof_system_templates` — 5 seeded templates (shingle, tile, metal, flat, gutters) with `inputs` jsonb
- `template_material_lines` — line label + default material + formula jsonb
- `template_labor_lines` — task + rate + formula jsonb
- `job_order_drafts` — per-job working state (template_id, inputs jsonb, line overrides jsonb, markup_pct, sales_tax_pct)
- `job_order_snapshots` — locked-in materials/labor/totals jsonb when "Save & Lock" is hit

Seed runs via the migration so every existing company gets the catalog + templates immediately.

### Sub-tabs inside the Order Form tab
1. **Build Order** (default) — measurement inputs, materials table, labor table, totals cards (Job Cost · Markup · Customer Price · Profit). Auto-recalcs from `calcQty(formula, inputs)`.
2. **Pre-Cap** — printable internal cost sheet
3. **Crew Work Order** — printable scope + materials checklist with signature lines
4. **Supplier Order** — printable PO grouped by category with supplier rep block

Each printable tab uses `window.print()` and a `.no-print` rule so only the active document prints.

### Admin (catalog + templates)
Lives at `/_app.settings.tsx` under a new "Materials & Templates" section (admin role only via `is_company_admin()`):
- **Material Catalog** — category chips, inline-editable SKU table
- **Roof Templates** — template chips, inline-editable line items with formula fields
- **Labor Rates** — inline-editable task list per template

### Branding
Reuse existing GCN tokens from `src/styles.css` (semantic tokens, NOT the raw black/gold hex from the prototype). The dark utilitarian look already matches; print views invert to white. Numbers use `JetBrains Mono` (already loaded). No new global CSS variables.

### Build order
1. Migration: 8 tables + RLS + seed data (suppliers, 16 categories, ~120 SKUs, 5 templates with all material + labor lines)
2. Hooks: `useMaterialCatalog`, `useRoofTemplates`, `useJobOrderDraft`
3. `lib/order-form-calc.ts` — `calcQty`, totals math
4. Route + sub-tab shell
5. Build Order tab (live data, editable lines, totals)
6. Pre-Cap / Work Order / Supplier Order print views
7. Admin section in Settings
8. Add "Order Form" entry to `JobTabs.tsx` between Estimate and Contract

### Scope notes
This is a large feature (~1500 LOC + a heavy migration with ~120 seeded SKUs). I'll ship it in this single approval but it will take a few minutes. Existing job/contract/estimate flow is not modified beyond the tab addition.