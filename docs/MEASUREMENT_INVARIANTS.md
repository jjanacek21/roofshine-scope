# MEASUREMENT INVARIANTS

Read this before any change to roof measurement, on either surface.

## 1. The AI draws ONE outline. Nothing else.

The trace's only job is the outline of the building, following the real roof
edges. One closed outline per structure. It must never split the roof into
facets or planes. Google Solar contributes pitch only — its segment boxes are
axis-aligned and can only ever produce a placeholder rectangle.

Enforced in `src/lib/solar-extract.server.ts` and `src/lib/auto-measure.functions.ts`.
There is no facet decomposition anywhere in the codebase; the Voronoi carving
module (`src/lib/roof-geometry.ts`) was deleted.

## 2. Refining the footprint never restarts it.

Adding a point to an outline must not reset the shape or re-run the trace.
Dragging a corner, deleting a point, and continuing must all preserve the same
structure and its identity. Every edit is one undo step.

## 3. One rendering component: the Claim Buddy editor.

`src/components/cb/CbRoofPlanEditor.tsx` is the measurement UI for BOTH
surfaces. GlobalContractor uses it through `src/components/roof/RoofPlanTab.tsx`
with property-scoped persistence in `src/lib/roofPlanStore.ts`. Claim Buddy uses
it with job-scoped persistence in `src/lib/cbRoofPlan.ts`. Do not standardize on
the older `SolarRoofTab` rendering.

## 4. Manual polygon draw is a way to START.

Hand drawing the outline is first-class on both surfaces — "Draw roof by hand"
in the editor — not a fallback offered only after the AI fails.

## 5. Regression guard.

`src/lib/roof-outline.ts` + `src/lib/roof-outline.test.ts` fail the build if a
trace returns more than one polygon per structure, if a polygon self-intersects
or has duplicate vertices, or if a result is a 4-point axis-aligned rectangle.
A failed trace returns `no_footprint` — never a fabricated square.
