# One highlighted roof per pin

Today a measurement can come back as several overlapping facet polygons (the screenshot shows Facet 1–4 stacked on one house). Facets are only merged into a single outline when exactly one pin was dropped; with more pins every facet stays separate, so colored shapes cross over each other and corner handles from different facets sit on top of one another.

## What changes

**One outline per pin**
- Every measurement run groups the returned facets by the pin they belong to, and merges each pin's facets into a single closed outline — always, whether there is one pin or four.
- Structure 1 (main roof) keeps the first overlay color, pin 2 (flat roof) gets the second, pin 3 (shed) the third, and so on, so each pinned roof reads as one clearly separate colored area.
- Each structure shows a single label ("Main roof · 1,842 sf"), not one label per facet, so the map stops being covered in overlapping text.
- Pitch for the merged outline comes from the largest facet in that group (unchanged behavior for single-pin runs).

**Editing stays exactly as it is now**
- Corner handles and midpoint handles on the merged outline: drag corners onto the real roof edges, tap a midpoint to add a corner. No change to how that feels.
- Handles only render for the selected structure, so two roofs' handles never fight for the same tap.

**After Save roof footprint**
- The outline locks: corner handles disappear and each perimeter segment becomes tappable to label it Eave or Rake.
- The line tool then adds interior lines (ridge, hip, valley, transition, flashing) which stay unlabeled until tapped and labeled — same flow as now, just clean because there is only one outline per structure underneath.

**Overlay clutter**
- The dashed AI reference trace is hidden by default and stays behind a single toggle.
- Confidence tint is applied to the merged outline's edges rather than to every facet.

## Technical details

- `src/lib/cbRoofPlan.ts`: generalize `mergeSectionsToFootprint` into a per-group merge (`mergeSectionsByStructure`) that unions rings within each pin group; keep the largest-outline fallback for MultiPolygon results and the existing area fallback. Assign `cbSectionColor(groupIndex)` and names ("Main roof", "Flat roof", "Structure 3").
- Group assignment: the server already runs one extract per pin, so tag returned segments with their pin index in `src/lib/cb-measure.server.ts`; when loading an existing plan from `roof_sections`, group by nearest pin/centroid clustering so previously saved multi-facet plans also collapse to one outline per structure.
- `src/routes/cb.job.$id.measure.tsx`: always call the per-structure merge instead of only when `measurePins.length === 1`.
- `src/components/cb/CbRoofPlanEditor.tsx`: one fill/outline/label feature per section, handles rendered only for the selected section, confidence tint moved onto the merged ring, AI trace off by default.
- Verify on a mobile viewport: two pins produce exactly two colored areas, corners drag, Save roof footprint locks, perimeter segments label as eave/rake, and interior lines draw and label afterward.
