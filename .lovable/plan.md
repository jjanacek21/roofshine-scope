# Unstick the Claim Buddy measurement step

Two things are wrong on `/cb/job/:id/measure`: the traced roof outline never appears over the satellite image, and the step won't let you continue to the inspection.

## What the data shows

For your latest job (2847 Northeast 2nd Avenue), the measurement engine actually worked: it saved a roof measurement of 32.14 squares / 2,795 sf at 3/12 with 4 traced facets stored in the database. But the Claim Buddy measurement row for that job is still all zeros with source "manual" — meaning the **Save never completed**. So the numbers you saw on screen were live in the page only, and pressing Save did not get you to the next screen.

The missing highlight is on the map/editor side, not the data side — the facets exist. A JavaScript crash is being reported from the preview on this surface, and the roof plan editor is lazy-loaded, so when it throws you get an empty area where the outline should be. That crash is unconfirmed as the exact cause; step 1 below is to confirm it before changing the editor.

## Fix plan

1. **Confirm the crash.** Reproduce the measure screen against a real job, capture the un-minified error and the failing Save call (exact database error text), so the fix targets the real cause rather than a guess.

2. **Never blank the screen.** Wrap the lazy roof plan editor in its own error boundary with a visible fallback ("Map couldn't load — Retry" plus a text summary: facet count, squares, pitch). A map failure stops the outline from drawing; it must never take the rest of the step down with it.

3. **Make the outline show reliably.** Redraw the facet overlay whenever the plan finishes loading and again after the map style loads, and fit the view to the traced facets. If the map token or style fails, show the facet list as text so you can still see what was measured.

4. **Make Save unblockable.** Save the measurement numbers first and the roof plan second, each with its own error handling; if the plan save fails, the measurement still saves and you still move on, with a clear message about what didn't save. Show the real error text instead of the generic "Couldn't save the measurement".

5. **Always give an exit.** Add a fixed bottom bar on the measure step with "Save & continue to inspection" and a secondary "Skip for now" that goes straight to the inspection hub, so this screen can never trap you again regardless of map or save state.

## Technical notes

- Route: `src/routes/cb.job.$id.measure.tsx` (save path lines 249-269, editor render lines 305-328).
- Editor: `src/components/cb/CbRoofPlanEditor.tsx` — error boundary + redraw on `plan`/`ready` change.
- Persistence: `saveCbMeasurement` and `saveCbRoofPlan` in `src/lib/cbMeasure.ts` / `src/lib/cbRoofPlan.ts`; the `cb_save_roof_plan` and `cb_roof_plan` functions themselves look correct and are not being changed.
- No changes to logo, colors, or any GlobalContractor screen.
