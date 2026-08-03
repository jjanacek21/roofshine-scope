# Xactimate-Style Estimate Format

Rebuild the estimate screen and its PDF export to match the "Final Draft" contractor document exactly in structure, with all content driven by the actual customer, job, company, and line items.

## Target layout (per estimate)

1. **Header block** — Client name, Property address, phone/email, Estimator (current user), Type of Estimate, Date Entered, Price List code, Estimate number. Company logo and contact info pulled dynamically from the company record (Free Bird, GCN, Advantex, etc.).
2. **Code / spec pages** (optional, toggleable) — the building-code narrative blocks that appear before the line items.
3. **Line item table** grouped by area (e.g. "Main Level") with columns:
   `DESCRIPTION | QTY | REMOVE | REPLACE | TAX | TOTAL`
   - Numbered rows, item names prefixed by action (`R&R`, `Remove`, `Replace`) as today.
   - Optional italic note paragraph under any item (code citations, explanations).
   - `Totals: <Area>` and `Total: <Estimate>` rows, then `Line Item Totals`.
4. **Summary** — Line Item Total, Material Sales Tax, Replacement Cost Value, Net Claim, estimator signature line.
5. **Recap of Taxes** — Material Sales Tax %, Laundering, Manuf. Home, Storage Rental columns.
6. **Recap by Room** — area subtotals with percentages.
7. **Recap by Category** — grouped by category (GENERAL DEMOLITION, ROOFING, MOISTURE PROTECTION, SOFFIT/FASCIA/GUTTER, ...) with totals and %, then Subtotal, Material Sales Tax, Total.

No depreciation, ACV, deductible, or claim/policy fields — contractor style only.

## Where it appears

- **Estimate screen** (`/jobs/:id/estimate`) — line item table switches to the six-column format grouped by area, with an inline note field per item. Add an "Estimate Document" preview tab showing the full paginated document.
- **PDF export** — a new estimate PDF generator that reproduces the same document, page numbering and running footer (`<estimate #> <date> Page: N`) included.

## Data changes

Add to `estimate_line_items`:
- `category` (text) — Xactimate category for the Recap by Category page, seeded from `line_item_master.category`
- `subgroup` (text)
- `remove_price`, `replace_price` (numeric) — seeded from the master catalog so the REMOVE/REPLACE columns are real values instead of a single unit price; TOTAL stays `qty × (remove + replace) + tax`
- `note` (text) — the italic paragraph under an item
- `area` (text, default "Main Level") — groups rows and drives Recap by Room

Add to `estimates`:
- `estimate_number` (text), `type_of_estimate` (text), `price_list_code` (text), `show_code_pages` (boolean)

Existing rows keep working: when remove/replace are null the current `unit_price` is used as REPLACE.

## Technical notes

- New `src/lib/estimate-document.ts` builds a pure data model (header, areas, rows, taxes, recaps) from the estimate + lines + company + job so both the on-screen preview and the PDF render from one source.
- New `src/components/estimate/EstimateDocument.tsx` renders that model; PDF export reuses the existing html2canvas/jsPDF pipeline in `src/lib/pdf-generator.ts` with per-page sections so the pagination matches.
- `LineItemTable.tsx` regroups by `area` then category instead of trade, and gains REMOVE / REPLACE / TAX columns plus a per-row note editor.
- Category defaults derive from `line_item_master.category`; a fallback map from trade covers custom items.
- Tax applies to material portion at the estimate's `tax_pct`, matching the Recap of Taxes page.
