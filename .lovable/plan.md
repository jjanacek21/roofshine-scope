## What's actually wrong

The pricing catalog has THREE price columns per row: `default_price`, `remove_price`, `replace_price`. For removal-only items (e.g. `0209 Remove Laminated … w/out felt`, `0238 Add. layer comp shingles, remove & disp.`, `0256 Tear off … Laminated`), the real price is stored in `remove_price` ($84.69, $50.93, etc.) but `default_price` is `$0.00`. The picker only reads `default_price`, so every removal/tear-off line shows `$0.00/SQ`. Data is fine; the UI is reading the wrong column.

## Fix in two parts

### 1. Show the right price (no DB changes)

Compute `effective_price` on the client when loading the catalog:
- if `replace_price > 0` → use it (it's the full R&R rate for combined rows)
- else if `remove_price > 0` → use it (removal-only rows like 0209, 0238, 0256)
- else → fall back to `default_price`

Apply to:
- `src/components/estimate/AddLineItemCombobox.tsx` — select `remove_price, replace_price` and map to `default_price` via the coalesce above.
- `src/components/catalog/MasterCatalogBrowser.tsx` — already loads both columns; replace the bare `default_price` display in the "Default" column with the same coalesce so the master view stops showing `$0.00` for removal rows.
- `src/components/catalog/CatalogTree.tsx` — no change needed; it just renders whatever `default_price` it receives.

### 2. Collapse matching Remove + Replace into one "R&R" row in the picker

Done in-memory in `AddLineItemCombobox` — no DB writes, no schema changes, master catalog stays intact for admins.

Algorithm:
```text
group rows by base = stripPrefix(name) + "|" + unit + "|" + trade + "|" + subgroup
  stripPrefix removes leading "Remove ", "Replace ", "Tear off …",
              "Add. layer … remove & disp. - " variants
for each group:
  if an existing R&R row is present → keep rows as-is (catalog already has it)
  else if exactly one Remove row + one Replace row exist for that base:
    emit a synthetic row:
      id        = `pair:${removeId}:${replaceId}`
      code      = `${removeCode}+${replaceCode}`
      name      = `R&R ${base}`
      unit      = replace.unit
      unit_price= (remove.remove_price ?? 0) + (replace.replace_price ?? replace.default_price)
    hide the two source rows
  else: leave rows untouched
```

When the user picks a synthetic pair row, `handlePick` resolves the `pair:` id and calls `onPick` twice (once for the remove row, once for the replace row) so the estimate keeps two auditable line items with their own prices. The picker just collapses the *choice*, not the billing detail.

### Out of scope (call out, don't build)
- Mutating `line_item_master` to add real R&R rows — leave the master as the contractor-friendly source of truth.
- Reflecting the pair-merge in `MasterCatalogBrowser` (admin view should stay row-accurate).
- Re-pricing existing estimates — only new picks benefit; old line items keep their stored `unit_price`.

## Files touched
- `src/components/estimate/AddLineItemCombobox.tsx` — load extra columns, coalesce price, build pair-merged list, fan-out on pick.
- `src/components/catalog/MasterCatalogBrowser.tsx` — coalesce in the "Default" column only.

## Verification
- Open the picker on an estimate, expand **Asphalt Shingles**: `0209 Remove Laminated…` shows `$84.69/SQ`, `0210 Replace Laminated…` is collapsed into a new `R&R Laminated - comp. shingle rfg. - w/out felt` priced at `$480.57/SQ` (84.69 + 395.88). Picking it adds both 0209 and 0210 to the estimate.
- `0256 Tear off … Laminated` shows `$84.69/SQ` (stays standalone — no matching Replace row).
- Existing real R&R rows (`0211 R&R Hip / Ridge cap…`) render unchanged.
- Master Catalog admin page shows correct Default price for every removal row; Remove/Replace columns unchanged.
