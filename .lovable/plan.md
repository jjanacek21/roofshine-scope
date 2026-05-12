## Goal

Replace the separate "Synthetic Underlayment" and "Peel & Stick (eaves/valleys)" template lines with **one line called "Underlayment"**. The rep picks which underlayment material to use per job (Synthetic, 30 lb Felt, Peel & Stick 1.5 sq, Peel & Stick 2 sq, Ice & Water Shield, Hi-Temp, etc.). Quantity auto-calculates from squares ÷ that roll's coverage + 10% waste.

## Schema changes

1. **`material_catalog`**: add `coverage_sq numeric` (squares covered per unit roll/box). Editable from Settings → Materials Templates.
2. **`material_categories`**: ensure an "Underlayment" category exists per company (and at master level).
3. **`template_material_lines.formula`**: support a new flag `use_material_coverage: true` — when set, `calcQty` divides by the selected material's `coverage_sq` instead of `formula.divide_by`.

## Data migration / seed

- Backfill `coverage_sq` on existing underlayment SKUs:
  - Synthetic (Titanium UDL / RhinoRoof U20, etc.) → 10
  - 30 lb Felt → 2
  - Peel & Stick 1.5 sq rolls → 1.5
  - Peel & Stick 2 sq rolls → 2
  - Ice & Water Shield (Polyglass IR-XE, etc.) → 2 (default; admin-editable)
  - Hi-Temp (Titanium PSU-30, Polyglass TU-Plus) → 2
- For each roof template:
  - **Shingle Roof**: delete the "Synthetic Underlayment" and "Peel & Stick (eaves/valleys)" lines; insert one "Underlayment" line with `formula = { base: "sq", waste_pct: 10, use_material_coverage: true }` defaulting to Synthetic.
  - **Metal Roof**: rename "Hi-Temp Underlayment" → "Underlayment", set the same formula, default to Hi-Temp.
  - **Tile Roof**: rename "Tile Underlayment (Hi-Temp SA)" → "Underlayment", same formula, default to Hi-Temp SA.

## Calc logic (`src/lib/order-form-calc.ts`)

Update `calcQty` to accept the resolved material and, when `formula.use_material_coverage` is true and the material has `coverage_sq > 0`, divide by `coverage_sq`. Falls back to `divide_by` if coverage is missing.

## UI changes

- **Order form materials grid** (`_app.jobs.$id.order-form.tsx`): for the "Underlayment" line, the material dropdown filters to items in the Underlayment category so reps see only underlayment SKUs. Qty recomputes when they switch material.
- **Settings → Materials Templates** (`MaterialsTemplatesTab.tsx`): show a "Coverage (sq)" column on material rows so admins can edit per SKU.

## Out of scope

- No changes to labor lines, snapshot workflow, dump/permit costs, or pricing math beyond qty calculation.
- No changes to the eave/rake LF input — it remains available but is no longer auto-consumed (reps can still add a manual P&S line if they need separate eave coverage on top of the field underlayment).
