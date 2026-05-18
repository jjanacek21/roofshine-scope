
# Draw everything first, label everything later

Right now drawing a hip that touches the perimeter is broken: the perimeter-segment overlay grabs the click and reopens the Eave/Rake prompt instead of letting Mapbox Draw drop a vertex. You also still get a label prompt the moment you select any line. Goal: the perimeter and all interior lines/points get drawn with zero labeling interruptions, and labeling only happens when you explicitly enter a "Label" mode.

## Target workflow

1. **Draw perimeter** → only pitch + name prompt (unchanged). Polygon closes, area shows.
2. **Stay in line/point draw mode** and add every hip, ridge, valley, flashing, transition, parapet line, plus penetration pins. No prompts. Lines can start/end exactly on a perimeter vertex (snap), and the perimeter is non-interactive while drawing.
3. **Switch to Label mode** (new toolbar button) → now clicking a perimeter segment, an interior line, or a point opens the inline label popover. Outside Label mode, clicking a feature just selects it for move/delete — never opens a prompt.
4. **Vertex-only snapping on perimeter**: when drawing a new line in `draw_line_string`, the first/last click on or near a perimeter vertex snaps to that vertex. Clicks on the middle of a perimeter segment drop a normal new vertex on the ground (they do NOT attach to the segment).

## Behavior changes

- Remove the auto-open label prompt on `draw.selectionchange` for LineString/Point — selection alone never prompts.
- Perimeter overlay (`perim-segs-line` / `perim-segs-hit`) becomes click-through except when `mode === "label"`. While drawing or in normal select, set its layers' `visibility: none` (and disable the hit layer) so Mapbox Draw receives the click and can drop a vertex on top of a perimeter line.
- Render small vertex dots for each polygon vertex on a new always-on `perim-vertices` source. While in `draw_line_string`, snap the cursor to the nearest vertex within ~12 px and commit that exact coordinate on click. Implemented in the `mousemove` / `click` handlers using `turf.distance` against the perimeter vertex list. No snapping to mid-segment points.
- New **Label** tool in `DrawToolbar` (alongside polygon/line/point/select). Sets a local `mode === "label"`. In this mode:
  - `simple_select` is active so features are clickable
  - perimeter overlay re-enables and clicking a segment opens the Eave/Rake popover
  - clicking an interior line opens the edge-type popover
  - clicking a point opens the penetration popover
- Outside Label mode, all `open*LabelPrompt` calls are gated off.
- Side-panel "Unlabeled lines (N)" and "Perimeter edges" lists keep working — clicking a row switches the tool to Label mode automatically, then opens that feature's popover.

## Files to touch

- `src/components/roof/MapboxRoofDraw.tsx`
  - Add `tool` state value `"label"`; thread through `DrawToolbar`.
  - Gate `openLineLabelPromptRef` / `openPointLabelPromptRef` / `openPerimeterLabelPromptRef` and the `draw.selectionchange` auto-prompt on `activeTool === "label"`.
  - Toggle `perim-segs-line` + `perim-segs-hit` visibility based on `activeTool` (visible only in `label`; hidden during draw + plain select so they don't intercept).
  - Add `perim-vertices` GeoJSON source/layer rebuilt from `features` (one Point per polygon vertex, deduped).
  - Add vertex snapping for `draw_line_string`: on `mousemove`, if pointer within snap radius of a perimeter vertex, set a ghost marker; on `click`, if snapped, call `draw.changeMode("draw_line_string")` trick — easier: intercept the click in capture phase, then call `map.fire("click", { lngLat: snappedLngLat, point: map.project(snappedLngLat) })` so MapboxDraw drops the vertex at the exact coord. (Standard MapboxDraw snap pattern.)
  - Keep "stay in draw mode after create" behavior so user can chain lines/points.
- `src/components/roof/DrawToolbar.tsx`
  - Add a `Label` button (Tag icon). Active state styling like the other tools.
- `src/components/roof/MeasurementTotalsPanel.tsx`
  - When user clicks a perimeter segment row or unlabeled-line row, fire a new `onRequestLabelMode()` callback before opening the popover.
- `src/lib/measurement-utils.ts` — no schema change. `perimeter_edges` already round-trips.

## Out of scope

- Auto-classifying eave vs rake from pitch direction.
- Snapping interior line endpoints to other interior lines (only perimeter vertices snap for now).
- Changing how data persists to Supabase.

