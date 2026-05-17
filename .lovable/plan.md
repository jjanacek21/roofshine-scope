## Add angle-snap toggle to roof polygon drawing

Add an optional "Snap" mode that constrains the next polygon vertex to a horizontal, vertical, or 45° line relative to the previous vertex while drawing. Toggleable on/off from the draw toolbar and via the `Shift` key as a temporary hold.

### UX
- New **Snap** button in `DrawToolbar` (next to Undo/Clear). Shows active state when on.
- When Snap is ON and the user is in `draw_polygon` (or `draw_line_string`) mode with at least one vertex placed, the cursor's projected position snaps to the nearest axis (0°, 45°, 90°, 135°) from the last committed vertex.
- Holding `Shift` temporarily inverts the current state (snap-on if off, snap-off if on) — matches Figma/Illustrator muscle memory.
- A thin guide line renders from the previous vertex to the snapped cursor position so the user can see the constraint.

### Technical approach (in `src/components/roof/MapboxRoofDraw.tsx`)
1. Add `snapEnabled` state + ref. Pass setter into `DrawToolbar` as a new optional prop.
2. On `map.on("mousemove")` while in `draw_polygon`/`draw_line_string`:
   - Read the in-progress feature via `draw.get(currentFeatureId)`.
   - Get the last committed vertex; compute angle from it to cursor lng/lat (projected to screen pixels for accurate angle, then unprojected back).
   - Snap angle to nearest multiple of 45°; recompute the snapped lng/lat at the same distance.
   - Call `draw.setCoordinates(...)` on the trailing (hover) vertex to move it to the snapped point. Mapbox Draw exposes the trailing point as the last coord of the in-progress line/ring — update via `setFeatureProperty` is not enough, so we use a small internal patch: replace `feature.geometry.coordinates[...]` and call `draw.add(feature)` to refresh, OR use `MapboxDraw.modes.draw_polygon` override (simpler: re-`add` the feature, Draw keeps the in-progress state correctly for hover vertex updates in v1.4+).
3. Render the guide via a dedicated `snap-guide` GeoJSON source + line layer (dashed, accent color), updated on each mousemove. Cleared when snap is off or mode leaves draw.
4. Track Shift via `keydown`/`keyup` listeners; combine with `snapEnabled` to produce `effectiveSnap`.

### Files to edit
- `src/components/roof/MapboxRoofDraw.tsx` — snap state, mousemove handler, guide layer, Shift listener.
- `src/components/roof/DrawToolbar.tsx` — add Snap toggle button + prop.

### Out of scope
- Snapping to other features' edges/vertices (true geometric snap). This plan only does axis-angle snap from the previous vertex, which is what the user asked for (vertical/horizontal straight lines).
