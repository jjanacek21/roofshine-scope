# One outline per structure, one measurement UI

First: no `MEASUREMENT_INVARIANTS.md` file arrived with the message — only the message text. I will author `docs/MEASUREMENT_INVARIANTS.md` from the five rules below and read it before every future measurement change. Paste the file if you have specific wording and I will use yours verbatim instead.

## The inventory you asked for

### Measurement UIs (client)

| File | Route / surface | What it does |
|---|---|---|
| `src/components/cb/CbRoofPlanEditor.tsx` (2,066 lines) | Claim Buddy — `/cb/job/:id/measure` | The rendering you want. Pin drop, single outline per structure, corner drag, midpoint "add a point" handles, delete point, line drawing/labelling, loupe, snap. |
| `src/routes/cb.job.$id.measure.tsx` (903) | Claim Buddy | Wraps the editor; calls `getInstantMeasurement`, then `mergeSectionsByStructure` to collapse whatever comes back into one outline per pin. |
| `src/components/roof/SolarRoofTab.tsx` (2,273) | GlobalContractor — `/jobs/:id/measure`, "Solar" tab | The second implementation. Renders **one section per AI facet** and labels them `Structure 1 · facet 1`. Source of the overlapping/crossing shapes. |
| `src/components/roof/MapboxRoofDraw.tsx` (1,150) | GlobalContractor — "Mapbox" tab | Manual polygon draw + edge labelling, GC only. |
| `src/components/roof/RoofMeasurementPanel.tsx` (620) | GlobalContractor container | Tab switcher: manual / mapbox / solar / condition / report. |
| `src/routes/_app.jobs.$id.measure.tsx` | GlobalContractor route | Mounts `RoofMeasurementPanel`. |
| `src/components/roof/ManualMeasurementForm.tsx`, `MeasureTuningPanel.tsx`, `PropertyLocationPicker.tsx`, `MeasurementTotalsPanel.tsx` | GC | Supporting panels. |

### Measurement engine (server)

| File | Role |
|---|---|
| `src/lib/roof-vision-trace.server.ts` | AI trace. Already asks for exactly ONE outer polygon, 3–24 points, no internal facets. This is the behaviour to keep. |
| `src/lib/footprint.server.ts` | OSM/PostGIS building outline lookup. One ring. Fine. |
| `src/lib/solar-extract.server.ts` | **Where facet decomposition happens.** Lines ~343–381: `carveFootprintByCenters(...)` cuts the footprint into Voronoi cells seeded on Google Solar segment centres, with `fitFacetsToFootprint(...)` as fallback; emits `segments[]` + `facet_source: footprint_voronoi \| footprint_faces \| segment_boxes`. |
| `src/lib/roof-geometry.ts` | Holds the decomposition primitives: `carveFootprintByCenters` (l.721), `fitFacetsToFootprint` (l.480), `consolidateSolarSegments` (l.338), `hipFaces` (l.274), `footprintFromSegmentBoxes` (l.580). |
| `src/lib/auto-measure.functions.ts` (l.216–257) | Second caller of `fitFacetsToFootprint`, used by automatic job-creation measurement. |
| `src/lib/cb-measure.server.ts` | Claim Buddy entry. Already prefers the single vision ring per pin and only falls back to the extractor footprint. |
| `src/routes/api.solar-roof-extract.ts` | HTTP wrapper that `SolarRoofTab` posts to. |
| `src/lib/roof-regularize.ts`, `roof-math.ts`, `roof-measurement-save.ts`, `cbRoofPlan.ts` | Squaring, area math, persistence, and CB-side merge-to-one-outline. |

Short version: the AI tracer is already single-outline. The facet split is created in `solar-extract.server.ts` using `roof-geometry.ts`, and only the GlobalContractor `SolarRoofTab` still renders it per facet.

## What I will change

1. **Delete the facet split.** In `solar-extract.server.ts`, stop carving. Return exactly one ring per structure: vision trace, else cached building footprint, else nothing. `carveFootprintByCenters`, `fitFacetsToFootprint`, `consolidateSolarSegments`, `hipFaces`, `footprintFromSegmentBoxes` get removed along with their callers in `auto-measure.functions.ts`. Google Solar is kept only for pitch and azimuth, never for shape. No rectangle fallback: a failed trace stays a failure with a retry/reposition prompt.

2. **One rendering component.** Promote `CbRoofPlanEditor` into a shared component used by both surfaces. `SolarRoofTab`'s map, facet list, and per-facet corner editing are deleted; `RoofMeasurementPanel` mounts the shared editor instead. Differences between desktop and mobile stay in CSS and props (`compact`, toolbar placement) — no second component and no forked copy.

3. **Add-a-point stays non-destructive.** The editor's midpoint handles insert a vertex into the existing ring and nothing else — no re-trace, no reset, no vertex cap. Corner drag, point delete, and repeat insertion all operate on the same outline. I will verify this by inserting several points in a row.

4. **Manual polygon draw is a first-class start on both surfaces.** "Draw roof by hand" sits next to "Measure roof" before any AI runs, on Claim Buddy and GlobalContractor: click-by-click on desktop with double-click/Enter to close, tap-by-tap on mobile. Existing GC edge labelling in `MapboxRoofDraw` keeps working against the drawn outline.

5. **Regression guard.** New `src/lib/roof-trace.test.ts` (vitest, alongside the existing `xact-report.test.ts`) with pure geometry validators asserting a trace result: has exactly one polygon per structure, is not self-intersecting, has no duplicate vertices, and is not a 4-point axis-aligned rectangle. The same validator runs in the server path so a bad shape is rejected at runtime, not just in CI.

6. **Doc.** `docs/MEASUREMENT_INVARIANTS.md` written from these rules and read before any future measurement change.

## Verification

Log in as the existing QA account and, with screenshots:
- one outline per structure on the real roof edges, no crossing lines, no duplicate vertices, no facet labels;
- add points repeatedly to the AI outline and drag each onto a corner, shape never resets;
- manual polygon draw completes a measurement with no AI call, desktop and mobile;
- the same at 390px on the Claim Buddy surface.

If login fails, the reply starts with "NOT VERIFIED — cannot log in" and the task is not called done.

## Out of scope

Takeoff sheets, estimates, reports, and any non-measurement screen.
