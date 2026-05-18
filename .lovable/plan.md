## Goal
Make the roof measurement tool behave like a true draw-first sketch tool:

1. Draw the perimeter and get SQFT.
2. Keep only the perimeter pins the user actually placed.
3. Draw ridges, hips, valleys, transitions, flashings, etc. without being forced to label anything.
4. Keep dots/vertices visible on all drawn lines so later lines can connect dot-to-dot.
5. Label perimeter segments and interior lines only when intentionally using the Label tool.

## What I’ll change

### 1. Stop perimeter segment clicks from interfering while drawing
- Disable the hidden perimeter segment hit layer except in explicit Label mode.
- When drawing interior lines, clicking a perimeter edge will no longer open the eave/rake prompt.
- Only actual perimeter pins/vertices will be valid connection targets on the perimeter.

### 2. Remove midpoint/split behavior from normal selection
- Hide/disable Mapbox Draw midpoint handles for existing polygon/line features during the normal workflow.
- This prevents accidental new points from being added to perimeter edges and splitting the line.
- Existing pins remain draggable/editable, but the app won’t invite accidental midpoint insertion.

### 3. Expand labeling options for perimeter segments
- Perimeter labels will no longer be restricted to only Eave/Rake.
- Perimeter segments can be labeled as eave, rake, transition, wall flashing, step flashing, gutter, ridge, hip, valley, etc., matching the same label set used for other lines.
- This supports perimeter edges that are parapet walls, transitions, flashing, or other roof conditions.

### 4. Keep vertices/dots visible for interior lines
- Add a line-vertices overlay source/layer similar to the perimeter-vertices overlay.
- Show dots at every vertex on every drawn line, not just the perimeter.
- Use these dots as connection/snap targets when drawing additional lines.

### 5. Snap only to real dropped pins/dots
- Replace the current perimeter-only snap list with a combined snap list of:
  - perimeter vertices the user placed
  - vertices on existing ridges/hips/valleys/flashings/transitions
- Do not snap to midpoint handles or arbitrary points along a segment.
- This means new lines can connect cleanly between existing dots without creating extra perimeter points.

### 6. Keep draw-first labeling behavior
- Lines and points will still be created unlabeled.
- The tool will stay in line/point drawing mode after each line/point, so the user can draw all geometry first.
- Label prompts will only open from Label mode or sidebar label actions.

## Files to update
- `src/components/roof/MapboxRoofDraw.tsx`
- `src/lib/mapbox-draw-styles.ts`
- possibly `src/components/roof/DrawToolbar.tsx` for clearer tool hints only if needed

## Validation
After implementation, I’ll verify the behavior in the preview:
- draw a perimeter
- draw a line ending on a perimeter pin
- confirm clicking perimeter edges while drawing does not label or split them
- confirm line vertices remain visible
- confirm a new line can snap/connect to a previous line’s dot
- confirm perimeter labels offer the full roof-line label set