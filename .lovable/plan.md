# Takeoff numbers come from the measurement

Stop hand-typing footage that the roof measurement already knows. Add a gutter run to the line labeling, and keep gutters on the roof sheet only.

## 1. Auto-filled takeoff fields

These roof takeoff lines fill themselves from the saved measurement:

| Takeoff field | Comes from |
| --- | --- |
| Drip edge | perimeter (eave + rake) |
| Starter | perimeter (eave + rake) |
| Rake edge | rake |
| Valley metal | valley |
| Ridge cap | ridge |
| Ridge vent (Ventilation card) | ridge |
| Gutter LF (Gutters card) | gutter-labeled runs |

Behavior: each field shows the derived number with a small "from measurement" note. If the rep types over it, their number wins and stays put (flagged as rep-adjusted); a "reset to measurement" tap restores the derived value. Changing the measurement later re-fills any field the rep has not overridden.

Downspout count stays manual — that is the only gutter number a rep has to count.

## 2. Gutter label on the measurement screen

The line labeler already has a Gutter type; it gets used properly:

- A run labeled Gutter counts toward BOTH the eave total and the gutter total, so labeling gutter along the front eave no longer removes that footage from the eave.
- Eave-labeled runs with no gutter tag count as eave only, and gutter total is 0 unless something is labeled Gutter.

## 3. Gutters live on the roof sheet only

Remove Gutter LF and Downspouts from the elevation (exterior) takeoff fields so the same footage is never entered twice. The roof takeoff Gutters card stays as the single home for gutter size, material, LF, downspouts, guards.

## Technical notes

- `src/lib/cbRoofPlan.ts` `planTotals`: `eave_lf = eave + gutter`, `gutter_lf = gutter` (drop the `|| byType.eave` fallback).
- `src/lib/cbSheet.ts`: add a derived-field map plus an `overrides` set stored in the sheet so a typed value is not re-derived; remove `gutter_lf` / `downspout_qty` from `CB_EXTERIOR_FIELDS`.
- `src/routes/cb.job.$id.takeoff.tsx`: after the measurement loads, apply derived values into `edge_metal.drip_edge_lf` / `rake_edge_lf` / `valley_metal_lf` / `ridge_cap_lf` / `starter_lf`, `ventilation.ridge_vent_lf`, `gutters.lf`; `QtyLine` for those keys gets the derived hint + reset affordance, and marks an override on manual edit.
- Section completion percentages count derived values as filled, so these cards no longer read 0%.
