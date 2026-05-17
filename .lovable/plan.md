## New roof measurement workflow

Replace the current polygon-first / per-segment-prompt flow with a two-phase workflow:

**Phase 1 — Draw edges.** You draw every roof edge as line segments (perimeter, hips, ridges, valleys, flashing, etc.), dropping pins at each corner. New endpoints snap to nearby existing pins so shared corners stay connected. No labeling prompts during drawing.

**Phase 2 — Label edges.** Click a "Label edges" button to enter labeling mode. Pick a label from a palette (Eave, Rake, Ridge, Hip, Valley, Flashing, Transition, etc. — pulled from existing `EDGE_LABELS`). The cursor "carries" that label, and every line you click gets tagged with it. Switch label, click more lines. Exit when done.

**Sqft auto-calculation.** When you finish drawing, the app detects which lines form the closed outer ring (via shared snapped endpoints) and auto-closes them into a polygon to compute plan area and sloped area. Interior lines (hips, ridges, valleys) don't affect area, only edge length totals.

## UX details

- Toolbar gains a primary "Draw edge" tool (line) and a "Label edges" toggle button.
- While drawing: clicking within ~12px of an existing pin snaps to it (visual highlight on the target pin). Double-click or Enter finishes the current line.
- While labeling: a label palette appears (chips with the same colors as `EDGE_COLORS`). Selected label is highlighted. Clicking any line applies it. Right-click or Shift-click clears the label.
- Labeled lines render in their `EDGE_COLORS` color; unlabeled lines render in a neutral "needs label" color so you can see what's left.
- Totals panel splits "Unlabeled edges" out so you know to finish labeling.
- Snap toggle and angle-snap (Shift) behavior from the existing code are preserved for drawing straight runs.

## Technical approach

Files to edit:
- `src/components/roof/MapboxRoofDraw.tsx` — replace per-segment perimeter label prompt with two modes: `draw` and `label`. Add endpoint-snap logic in the `draw_line_string` mousedown (query rendered pin features within pixel radius; substitute coords). Add `labelingEdgeType` state. In `simple_select` while `mode === "label"`, intercept clicks on line features and write `edge_type` directly instead of opening the dialog.
- `src/components/roof/DrawToolbar.tsx` — add "Label edges" toggle and the label palette (renders only when in label mode). Keep Draw / Select / Undo / Clear / Snap.
- `src/lib/measurement-utils.ts` — add `closeRingFromLines(lines)` that builds an adjacency graph of snapped endpoints and extracts the outer cycle, then returns plan/sloped sqft. Update `computeTotals` so polygons are derived from the line set rather than required as input.
- `src/lib/mapbox-draw-styles.ts` — add a style branch for unlabeled lines (dashed neutral) vs labeled lines (solid in `EDGE_COLORS`).
- `src/components/roof/MeasurementPromptDialog.tsx` — the per-segment perimeter prompt path becomes unused; leave the dialog component intact (still used for pitch + penetration), just stop opening it from the perimeter click intercept.

Removed behavior:
- The polygon-perimeter midpoint click → label dialog flow (the source of the "extra pin / split segment" bug) is gone. Labels live on standalone line features, so clicking a line never mutates its geometry.
- The canvas `mousedown` intercept on `perim-segs-hit` is removed.

Data model:
- One feature per drawn edge: `LineString` with `properties.edge_type: EdgeType | null`.
- Pins are derived from line endpoints; no separate point features needed for corners (penetration points stay as their own `Point` features).
- Auto-closed polygon is computed on the fly for totals; not stored as a separate feature.

## Out of scope

- Changing how penetrations work.
- Multi-section roofs (multiple closed polygons in one job). If only one closed ring is found, that's the section. Multi-ring support can be added later if needed.
- Migrating any saved jobs that already used the polygon model — existing data continues to render via the existing polygon code path; new draws use the line model.
