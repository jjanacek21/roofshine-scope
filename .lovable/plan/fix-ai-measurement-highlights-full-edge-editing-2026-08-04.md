# Fix AI measurement highlights + full edge editing

Scope: the Job > Measure tab (AI measurements on the satellite map).

## Problems

1. The measured area often shows no colored highlight. The overlay only repaints when `pins`, `showOverlay`, or a map-ready counter changes, and the fallback path re-registers an `idle` listener that can be lost during style reloads. If the style is still swapping when results arrive, the facet sources are recreated empty and never refilled.
2. Edges can only be nudged: corner handles appear solely in edit mode, and you can only drag existing corners — no way to add a point where the roof has an extra corner, or delete a stray one.
3. Corrections are only saved when you press the save button, so a lot of good ground truth never reaches the training data.

## What changes

**Highlight reliability**
- Repaint overlays from a single helper that is called on: map load, every `styledata`/`idle`, pin changes, and immediately after each measurement completes.
- Keep the last painted feature collection in a ref and re-apply it whenever layers are (re)created, so a style reload can never leave the map blank.
- Auto-enable the highlight toggle and fit the map to the measured facets right after a run, so you always see what was measured.
- Show a small "N facets · X sqft highlighted" line under the map, plus a warning chip when a measurement returned zero drawable rings (so a blank map is explained rather than silent).

**Edge editing**
- Corner handles: keep drag-to-move, and add
  - midpoint handles (small hollow dots) between corners — drag one to insert a new corner there;
  - alt/right-click (and a delete key press while a handle is focused) on a corner to remove it, blocked below 3 corners.
- Recompute facet area and the pin total on every edit, live.
- Add "Undo last edit" and "Reset facet to AI shape" so a mistake is cheap.
- Entering edit mode zooms to the facet and dims other facets so handles are easy to hit.

**Save to the brain**
- On exiting edit mode (or pressing Save), write the AI original vs. corrected rings to `training_examples` via the existing vertex-correction path, including per-facet area delta and the job/property id.
- Persist the corrected geometry back to `roof_measurements.ai_geometry` and `roof_sections` so reports and the Mapbox tab use the corrected shape.
- Toast confirms "Corrections saved to AI training".

## Technical notes

- All work is in `src/components/roof/SolarRoofTab.tsx` (overlay sync effect, vertex-marker effect, measure mutations) plus the existing `saveVertexCorrections` helper and `src/lib/measure-handoff.ts` for the training payload.
- No schema changes: `training_examples`, `roof_measurements.ai_geometry`, and `roof_sections` already hold everything needed.
- Storm Intel's "Measure this roof" card is untouched.
