# Why the phone shows piles of footprints — and how to fix it

## Short answer

There is no phone-specific or gcn.claims-specific measurement code. The measure screen, the map editor and the merge logic are identical on both surfaces — nothing in them checks the hostname or the surface. So the difference is not "phone vs computer". It comes from two other things:

1. **What build each address is serving.** gcn.claims and globalcontractor.app serve the *published* app; the Lovable preview serves the newest build. If the clean one-outline-per-pin behaviour was built but not published yet, the phone is still running the older version. (Unconfirmed — worth checking before anything else.)
2. **A real bug with older saved roofs.** Confirmed in the code: when a plan is loaded back from the database, any facet saved *before* the per-structure work got a made-up unique key (`structure-1`, `structure-2`, …) — one per facet, not one per building. The merge step groups by that key, so every old facet stays its own highlighted outline with its own label. That is exactly the screenshot: "Main roof", "Flat roof", "Structure 3", "Structure 5" all stacked on one house.

The desktop job you compared against was measured after the change, so its rows carry real structure keys and collapse correctly.

## The fix

1. Publish the current build so gcn.claims runs the same code as the preview.
2. When a loaded facet has no stored structure key, stop inventing a unique one. Instead group those facets by which dropped pin they sit closest to (or, with no pins, by overlap), so legacy roofs collapse into one outline per building just like new ones.
3. After that collapse, write the resolved keys back on the next save, so each roof is permanently pinned to its own structure and never re-splits.
4. Re-label and re-colour after grouping so numbering is always Main roof / Flat roof / Structure 3 in pin order, with no gaps.

## Technical notes

- `src/lib/cbRoofPlan.ts` — in the plan loader (~line 553) the fallback `s.structure_key || \`structure-${i + 1}\`` is the root cause; leave the key empty when the column is null so the grouping fallbacks in `mergeSectionsByStructure` can run. The `keyed.size && …length === plan.sections.length` guard at ~line 284 then correctly falls through to pin-proximity/overlap clustering for mixed plans; that branch needs to handle partially-keyed plans (keyed groups kept, unkeyed facets assigned to their nearest keyed group or pin).
- `src/routes/cb.job.$id.measure.tsx` — after the collapse in the `planData` effect, the plan is already marked dirty when section counts differ; ensure it saves the newly assigned keys so the repair is one-time per job.
- No change to the map editor UI, colours, or the save/takeoff flow.
