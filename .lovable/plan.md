## Problem

When a roof polygon already exists on the map, clicking on its blue fill while in **line** or **point** draw modes (to add ridges / valleys / eaves / penetrations) gets absorbed by Mapbox Draw — it treats the click as "select the polygon" instead of "drop a vertex / point here". The existing capture-phase interceptor in `MapboxRoofDraw.tsx` tries to swallow these clicks and re-fire them via `map.fire("click", ...)`, but `map.fire` does not invoke Mapbox Draw's internal DOM click handler reliably for line/point modes, so vertices simply don't land.

## Fix

Replace the fragile "intercept + re-fire" approach with a deterministic one: **make existing polygons non-hit-testable while the user is actively drawing lines or points**, then restore them when drawing finishes.

### Changes (single file: `src/components/roof/MapboxRoofDraw.tsx`)

1. **Remove** the `onPointerDownCapture` mousedown interceptor block (lines ~185–228) and its `canvas.addEventListener` / cleanup. It's the source of the broken behavior and will no longer be needed.

2. **Add a `draw.modechange` side-effect**: when entering `draw_line_string` or `draw_point`, call `map.setPaintProperty()` on the inactive Draw polygon fill layers (`gl-draw-polygon-fill-inactive.cold` and `.hot`) to set `fill-opacity` to `0.001` AND set `fill-color` unchanged — but more importantly, set the *layer filter* to exclude all features so `queryRenderedFeatures` returns nothing. Simpler: use `map.setLayoutProperty(layerId, "visibility", "none")` on those two fill layers while drawing. The polygon outline (`gl-draw-polygon-stroke-inactive.*`) stays visible so the user still sees the roof footprint.

3. **On `modechange` back to `simple_select` or `draw_polygon`**, restore `visibility` to `"visible"` on those fill layers.

4. Keep the existing single-click-to-direct_select behavior and Enter/Esc keybinds — they're unrelated and working.

### Why this works

Mapbox Draw decides "did the user click a feature?" by querying its own rendered layers. Hiding the inactive fill layer removes it from hit-testing entirely, so clicks pass straight through to the map ground and Draw's line/point mode drops a vertex exactly where the user clicked. The polygon's stroke remains visible so the footprint is still clearly shown in orange/blue outline.

### Verification

- Draw a roof polygon, confirm pitch dialog, see blue fill.
- Pick the line tool → click *inside* the polygon → vertex drops.
- Continue clicking along a ridge that crosses the polygon → all vertices land.
- Press Enter to finish → edge type dialog appears, line is saved.
- Switch back to select tool → polygon fill visible again, can be selected and edited.
- Same flow works for the point/penetration tool.