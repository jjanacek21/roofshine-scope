# Defer-label workflow for Mapbox measurements

Today every shape you draw immediately opens a modal: polygon → pitch, line → edge type, point → penetration. You asked to keep drawing fluid and label things afterward, plus add per-edge labels on the polygon perimeter so eaves/rakes drive starter, drip edge, and gutter totals.

## Target workflow

1. **Draw a roof polygon.** A small popover asks only for pitch + name (kept — needed for area math). No per-edge prompt.
2. **Label perimeter edges.** Each polygon segment between two vertices becomes a selectable mini-edge. Click any segment on the map (or in the side panel list) → choose **Eave** or **Rake**. Unlabeled segments render dashed/gray. Eave length auto-feeds gutter total.
3. **Draw all interior lines** (ridge, hip, valley, flashing, transition, step flash, etc.) back-to-back with no prompts. Drawing tool stays active until you press Esc / switch tools.
4. **Label interior lines.** Click a line on the map → inline popover with the edge-type chips. Or use the new "Unlabeled lines (N)" list in the side panel to step through them.
5. Points (penetrations) behave the same: drop freely, label later.

## Side panel changes

New section **"Perimeter edges"** per roof section:
- One row per polygon segment, numbered, with length in LF and an Eave/Rake/— selector
- Subtotals: Eaves (= gutters / starter), Rakes (= drip edge rake), Total perimeter

New section **"Unlabeled lines (N)"** at top of Edges block — clicking a row selects the line on the map and opens the label popover. Hidden when N = 0.

Totals get two new derived rows:
- **Gutters** = eave LF (perimeter, from polygons)
- **Starter / drip edge eave** = eave LF; **Drip edge rake** = rake LF

## Technical notes

Files to touch:
- `src/lib/measurement-utils.ts` — add `perimeter_edges` to `FeatureProps` on polygons: `string[]` indexed by segment, values `"eave" | "rake" | null`. Extend `computeTotals` to sum polygon perimeter LF by label and merge eave/rake into the existing `edges` totals.
- `src/components/roof/MapboxRoofDraw.tsx`
  - Remove the auto-prompt for `LineString` and `Point` features in `promptForFeature`. Keep the pitch prompt for polygons.
  - After finishing draw, stay in the active draw mode so you can keep adding shapes (already true for polygon — extend to line/point by re-entering the mode in the `draw.create` handler instead of falling back to simple_select).
  - Add a "selected feature" popover: on `draw.selectionchange` for a LineString or Point in `simple_select`, anchor a Mapbox `Popup` at the feature centroid with the chip grid (reuse `EDGE_LABELS` / `PENETRATION_LABELS`). Selecting writes the property via `draw.setFeatureProperty` and `syncFromDraw`.
  - Render a thin overlay layer for polygon perimeter segments colored by their label (eave/rake/unlabeled). Implement as a derived GeoJSON source rebuilt from `features` on every change; click handler sets the active segment and opens the same popover.
- `src/components/roof/MeasurementTotalsPanel.tsx` — new `PerimeterEdgesList` per section and `UnlabeledLines` callout. Wire callbacks up through `MapboxRoofDraw` props.
- `src/components/roof/MeasurementPromptDialog.tsx` — keep the pitch prompt; the edge + penetration variants are no longer triggered on create but are still used by the click-to-label popover (we move that UI inline instead, so the `edge` and `penetration` variants can be removed once the popover lands).
- Persistence: polygon `perimeter_edges` is just another property on the GeoJSON feature, so existing save/load already round-trips it. No DB migration needed.

## Out of scope

- Auto-detecting which sides are eaves vs rakes from pitch direction (could come later).
- Changing the underlying `edges` schema or how `RoofMeasurementPanel` saves to Supabase.
- Touching the AI measurement or manual entry tabs.
