# Claim Buddy dashboard: reorder actions + separate Dispositions list

## What changes

1. Action buttons, top to bottom, above everything else:
   - Survival Guide (new)
   - Door to Door mode
   - Start Inspection
2. "Pick up where you left off" card moves to sit directly under Start Inspection (today it sits above the buttons).
3. Below that: search + filter chips + the inspection list (unchanged).
4. A new "Dispositions" chip is added after "Converted". It is a separate view, not a status filter:
   - Selecting it swaps the list for canvassed properties from Door to Door mode that have not become inspections yet.
   - "All" and every status chip continue to show only inspections, so unconverted dispositions never mix into the inspection list.
   - Each disposition row shows address, resident name, disposition label, and last-updated date, and tapping it opens the Door to Door map focused on that pin.

## Survival Guide button

Claim Buddy runs on its own surface, so it needs its own page rather than the platform route. A new `/cb/survival-guide` screen renders the same guide inside the Claim Buddy shell with a back link to the dashboard.

## Technical notes

- `src/components/claim-buddy/CbDashboard.tsx`: reorder the action block, move the resume card, add the `Dispositions` chip and a second list branch backed by a query on `property_dispositions` (scoped to the signed-in user, excluding rows already linked to a Claim Buddy job).
- New route `src/routes/cb.survival-guide.tsx`: iframes `/survival-guide/index.html` full-height inside `CbSurface`, with its own head metadata.
- Navigating from a disposition row uses `/cb/map` with the property coordinates as search params; `src/routes/cb.map.tsx` reads them to center and open that pin's panel.
- No changes to inspection creation, measurement, or report logic.
