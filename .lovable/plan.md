

## Problem

Manually-dropped pins start with `plan_area_sqft: 0` and there's no way to measure them — only AI-detected pins get an area from the Solar API. The "Edit pin" panel shows a numeric input but the user has to guess and type the sqft. There's no per-pin "measure this" button.

## Plan: Add per-pin "Measure area" actions

### 1. Per-pin "Measure" button (primary fix)
In the **Edit pin** panel, next to the **Plan area** field, add a **Measure area at this location** button. It calls the existing `/api/solar-roof-extract` with the pin's `lng/lat`, finds the closest returned segment, and fills in:
- `plan_area_sqft` (rounded)
- `pitch` (auto-detected, only if pin is "pitched")
- `ring` (Solar API bounding box for later handoff to Mapbox tab)

If Solar API has no building data at that exact spot, show a toast: *"No structure detected here — enter sqft manually or draw it on the Mapbox tab."*

### 2. Quick-draw fallback for missed structures
For sheds / detached structures Google Solar misses, add a **"Draw area"** mini-mode on the active pin: toggling it lets the user click 3+ points on the map to outline a polygon around that structure. We compute its area with the existing `polygonAreaSqft` helper from `src/lib/roof-math.ts` and write it into the pin's `plan_area_sqft` + `ring`. ESC or "Done" exits draw mode.

### 3. Bulk action
Add a **"Measure all unmeasured pins"** button on the Pins list header — loops through pins where `plan_area_sqft === 0` and runs the same Solar lookup for each.

### 4. Visual hint on pins with 0 sqft
In the Pins list row + on the map marker, show an amber dot/indicator when `plan_area_sqft === 0` so users immediately see which pins still need measuring. Totals already exclude zero, but the warning makes it obvious why squares look low.

### Files to change
- `src/components/roof/SolarRoofTab.tsx` — add measure-button mutation, draw-mode state + map handlers, bulk-measure action, 0-sqft indicators.
- No backend / schema changes — reusing `/api/solar-roof-extract` and `polygonAreaSqft`.

### Out of scope
- Replacing Mapbox tab with this draw mode (this is just a quick fallback; Mapbox tab stays the precision tool).
- Per-pin imagery preview in the popup.

