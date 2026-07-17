## Goal

Add an "SPF Calculator" tab inside the existing Roof King section that runs the SPF Scope & Cost Engine natively (React + Tailwind), themed to match Roof King. All math and data tables are ported verbatim from the uploaded HTML — no formula changes.

## Files

**New**
- `src/lib/spf/data.ts` — exports `PRODUCTS`, `METHODS`, `SCOPES`, `STACKS`, `DETAILS_SEED`, `FIELD_DEFAULTS` (every default value copied verbatim from the HTML `id` inputs/selects).
- `src/lib/spf/engine.ts` — pure functions ported verbatim:
  - `heightFactor`, `hoseFactor`, `accessFactor`
  - `defWaste(method, scope, foamTex)`
  - `newLayer`, `stackFromPreset`
  - `detailArea(details)`, `detailTotal(details)`
  - `calc(fields, layers, details)` → returns `{ sqft, sq, bf, sets, gal, days, coatDays, laborFactor, materials, tax, removal, fieldLabor, equipment, details, soft, gl, cont, oh, permit, commission, finance, bondC, sell, totalCost, gp, layerRows, seamArea, rustArea, foamOn, totMils, groups, flags, breakdown }`
  - `buildScope(calcOut, fields, details)` → returns the plain-text scope (same 8-section format).
- `src/lib/spf/presets.ts` — the 4 presets (`recover`, `tearoff`, `metal`, `restore`) with the same field overrides + stack keys.
- `src/routes/_app.roofking.spf.tsx` — new route `/roofking/spf`, mounted under the existing Roof King layout so the sub-nav, top bar, and theme carry over automatically.
- `src/components/roofking/spf/SPFCalculator.tsx` — the page component; state via `useState` + `useMemo(calc)`.
- `src/components/roofking/spf/sections/` — one file per section (`ProjectSection`, `ExistingSection`, `AccessSection`, `FoamSection`, `CoatingStackSection`, `DetailsSection`, `LaborSection`, `EquipmentSection`, `SoftCostsSection`, `MarkupsSection`) — mirrors the 10 collapsible panels in the source.
- `src/components/roofking/spf/ResultsRail.tsx` — sticky sell price card, KPIs, stacked bar, legend, flags, cost breakdown list, scope <pre>, Copy/Print/Export/Import buttons.

**Edited**
- `src/routes/_app.roofking.tsx` — add one entry to `TABS`: `{ to: "/roofking/spf", label: "SPF Calculator", icon: Calculator }` (Lucide `Calculator`). No other changes.

**Not touched:** `_app.tsx`, main `AppSidebar`, any non-Roof King code. GCN branding elsewhere is unaffected.

## UI mapping (no visual regression from source)

- Reuse existing Roof King tokens (`rk-card`, `rk-input`, `rk-btn`, `rk-subnav-link`, `--rk-*` colors) so it inherits the dark theme; keep the source's amber accent for the sell-price big number and section rules.
- Two-column layout on ≥1150px (`grid-cols-[minmax(0,1fr)_400px]`), single column below — same breakpoint as source.
- Each section is a `<details>` (native collapse) styled with an amber left-rule to match `details.sec` in the source. Same open-by-default set (Project, Foam, Coating stack, Markups).
- Coating stack renders as an editable table with the same 13 columns (checkbox, product, applied-to, amount, method, mils, solids, $/gal, waste, area, gal, cost, delete).
- Details section renders the DETAILS array as an editable table with `+ Add custom detail line`.
- Rail card: big amber `Sell price`, 8 KPIs (`$/sq ft`, `$/square`, `Total cost`, `Gross profit`, `Crew days`, `Board feet`, `Foam sets`, `Coating gal`), stacked bar, legend, flags list, itemized breakdown, scope `<pre>` with Copy button. Print button uses `window.print()` with the same print CSS overrides.

## Math correctness

`engine.ts` is a straight TypeScript port of the `calc()` function (lines 549–726) and `buildScope()` (lines 728–796). Constants preserved exactly:
- Coating gallons: `area * mils / (1604 * solids/100) * (1 + waste/100)`
- Sell solve: `k = 1 - (mgn + comm + fin + bond + permitPct)`, `sell = (cost + permitFlatOnly) / k`, permit re-solve when floor kicks in.
- Foam sets: `ceil(bf * (1 + waste/100) * amb / yield)`
- `laborFactor = geo * slope * heightFactor * hoseFactor * accessFactor * occ * shift`
- `defWaste = foamTex(if spray) + methodExtra + (10 if seams/details)`
- All 15 flag rules preserved verbatim.

Unit test (out of scope for this PR unless requested): feed the source's default inputs through `calc()` and assert the same sell price the HTML shows on first load.

## IO

- Export → downloads JSON `{ fields, layers, details }` matching the source's schema exactly, so exports are interchangeable with the standalone HTML.
- Import → hidden file input, same parse-and-set behavior.
- Presets buttons in the header row of the calculator page (Recover / Tear-off / Metal / Coating restore) call `loadPreset(key)` which merges field overrides then loads the matching stack.

## Access

The route is nested under `_app.roofking` so the existing `useIsRoofKing` gate in the layout applies — non-Roof-King companies can't reach it and won't see the tab.

## Out of scope

- No database persistence, no server function, no cross-linking to jobs/estimates (can be added in a follow-up if requested).
- No changes to GCN branding, sidebars outside Roof King, or any other routes.
