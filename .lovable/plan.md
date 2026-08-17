# Bring back corner dots, blank edge dots and pin dragging on the measure screen

## What is happening

All of this is in `src/components/cb/CbRoofPlanEditor.tsx`, and it is caused by gates added in the last pass — not by the drag code itself. The press-and-hold + magnifier gesture is still there and still works; the handles you press are simply not on screen most of the time.

1. **Corner and edge dots disappear as soon as you leave "select".** The handle block only renders when `tool === "select"` and the section is not saved. Tapping "Continue to lines" switches the tool to `line`, and "Save this footprint" marks the section locked — either one hides every corner handle and every blank midpoint dot. In your screenshot you are in line mode, which is exactly why nothing is grabbable.
2. **The blank dots on the perimeter are hidden at normal zoom.** Midpoints only render when the map is zoomed past 20.3, or when they sit directly either side of the corner you last touched. At the zoom in your screenshot there are none at all, so there is no way to add a new point on an edge.
3. **Pin dragging is inconsistent.** Pin handles render, but when the GL layers have not come up the editor also adds Mapbox DOM markers for the same pins. Those markers sit above the handle layer and swallow the press, so the hold-and-drag never starts on that pin.
4. **Dropping an extra pin is blocked mid-edit.** "Add another roof" is disabled until every section is saved, and map taps only drop a pin while pin-drop mode is on — so while you are refining a footprint there is no way to place a new pin.

## The fix

All in `CbRoofPlanEditor.tsx`, plus one small change on `src/routes/cb.job.$id.measure.tsx`.

1. Show corner handles for the active section in every tool, not just `select` — including while drawing lines and after the footprint is saved. Dragging a corner on a saved footprint re-opens it for editing (same behaviour as "Edit footprint" today) so nothing is silently changed behind a "Saved" chip.
2. Always show the blank midpoint dots on the active section: drop the zoom-20.3 rule and the adjacent-only rule. Keep them visually smaller than corner dots, and skip any midpoint that projects within ~18px of a corner so packed edges do not turn into a wall of overlapping targets.
3. Make pin handles reliably draggable: give the DOM pin handles a higher stacking order than the Mapbox markers, and set `pointer-events: none` on the fallback marker elements so the press always lands on the draggable handle. Pins keep the press-and-hold + loupe behaviour.
4. Let a pin be dropped without first saving the footprint: enable "Add another roof" at all times, and keep the current tap-to-place flow once pin-drop mode is on.
5. Leave the gesture mechanics untouched — 250ms pickup, deliberate-movement pickup, pointer capture, map-pan suppression, loupe, hold-to-delete and 44px hit areas all stay as they are.

## Notes

No changes to logo, colors, measurement math, regularization, the takeoff/estimate screens, or any GlobalContractor screen. Verification: on the measure screen, at default zoom, confirm every corner shows a white dot and every edge shows a blank dot in select mode, in line mode and after saving; confirm holding a corner or a pin pops the magnifier and moves it; confirm a new pin can be dropped while a footprint is still being adjusted.
