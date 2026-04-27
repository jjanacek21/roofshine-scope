## What's happening today

Two annoyances in the Mapbox correction tool, both confirmed by reading `src/components/roof/MapboxRoofDraw.tsx`:

1. **Pins don't feel draggable.** Mapbox Draw *does* let you drag a vertex, but only after you enter `direct_select` mode — which currently requires the exact gesture of single-clicking a polygon while the Select tool is active. There's no visual cue, no instruction, and it's easy to think the pins are frozen.
2. **Clicking inside a blue polygon while drawing a new one finishes the drawing.** While `draw_polygon` mode is active, every map click adds a vertex — *including* clicks that land on an existing roof's blue fill. The first such click drops a stray vertex; the second snaps to the same spot and Mapbox Draw treats that as "double-click → finish polygon." So if you're trying to trace around or over an existing shape, the new polygon ends prematurely.

## The fix

### 1. Drag pins like you'd expect

Two changes so the existing drag behavior is actually discoverable:

- **Auto-enter direct_select on hover/click of any polygon when the Select tool is active.** Today you have to click once to "select" then click again to "edit vertices." We collapse that to one click: if the Select tool is on and you click an existing roof, jump straight into `direct_select` for that feature. Pins immediately become draggable.
- **Beef up vertex hit targets.** Bump the vertex circle radius from the default ~5px to ~8px (and halo to ~11px) in `src/lib/mapbox-draw-styles.ts` so they're easier to grab on touch and at lower zoom. Also bump `mapbox-gl-draw`'s `clickBuffer` so a near-miss click still grabs the vertex.
- **Add a one-line hint in `DrawToolbar`** that appears when the Select tool is active: *"Click a roof to edit · drag pins to move corners · drag midpoints to add a corner"*.

Mapbox Draw's `direct_select` already supports dragging the small **midpoint** circles between vertices — that drops a *new* vertex exactly where you want it, perfect for tucking the polygon edge into a corner. We just need to surface this with the hint.

### 2. Stop accidental polygon completion

When the Polygon tool is the active tool and the user is mid-draw:

- **Make existing polygons click-through.** While `draw_polygon` mode is active, set the existing polygons' `fill-opacity` to ~0.15 *and* disable their interactivity so a click on the blue area registers against the basemap, dropping the vertex where the cursor is — not getting absorbed into a finish gesture. Done by adding a one-time `mode === 'draw_polygon'` filter case in `MAPBOX_DRAW_STYLES` plus toggling `map.setLayoutProperty` on the existing draw fill layer when mode changes.
- **Block the "click on own vertex finishes" trap when the click was actually on a different polygon's fill.** In `MapboxRoofDraw.tsx`, attach a `map.on('click')` handler that runs *before* Mapbox Draw's handler when `activeTool === 'polygon'`. If the click feature under the cursor is a `gl-draw-polygon-fill-*` layer that does NOT belong to the in-progress feature, swallow that click and re-dispatch it at the same lng/lat with `interactiveLayerIds = []` so Draw treats it as plain map ground.
- **Make completion explicit.** Show a small floating chip near the cursor while drawing: *"Press Enter or double-click to finish · Esc to cancel."* Esc already cancels via Mapbox Draw; we'll wire `keydown` Enter to `draw.changeMode('simple_select')` which Mapbox Draw promotes to "finish current polygon."

## Files touched

- `src/components/roof/MapboxRoofDraw.tsx` — single-click → direct_select, click-swallowing during polygon draw, Enter-to-finish keybind, hint chip while drawing.
- `src/lib/mapbox-draw-styles.ts` — bigger vertex/halo radii, dimmed/non-interactive fill style for existing polygons while a new one is being drawn.
- `src/components/roof/DrawToolbar.tsx` — small contextual hint line under the active tool button.

## Out of scope

- No changes to Solar tab, totals, save flow, or any DB schema.
- No new dependencies.

## After this ships

- Click any blue roof once → its corners turn into draggable pins. Click-and-hold a pin and slide it to the corner of the chimney. Drag a midpoint to add a new pin between two existing corners.
- Start a new polygon, drag your cursor across an existing roof's blue fill — the click drops a vertex on the ground, not on the existing roof, so your in-progress polygon keeps drawing. Finish only when you press Enter, double-click, or click your starting vertex.
