# One roof takeoff sheet, and lines that let go of a corner

## 1. The wrong takeoff screen is the one you land on

There are two roof takeoff screens in the app right now:

- The **list** version at `/cb/job/{id}/roof` — one long catalog checklist, which is where duplicates like two pipe-jack entries come from. This is what the inspection hub sends you to.
- The **sectioned** version at `/cb/job/{id}/takeoff` — Wide shots, Roof system, Measurements, Decking, Underlayment, Flashing, Chimney, Ventilation, Penetrations, Skylights, Flat / low-slope, Insulation, Edge metal, Solar, Gutters, Accessories, Roof notes, each with its own completion chip. This matches your screenshots, and it is what the review screen's "Go to takeoff" button opens — which is why the two look different.

Fix: make the sectioned sheet the only roof takeoff.

- The inspection hub's "Roof" card opens the sectioned sheet instead of the list.
- The list screen is removed; `/cb/job/{id}/roof` redirects to the sectioned sheet so old links and any in-progress job still land somewhere correct.
- Any data already entered on the list screen stays where it is — both screens write to the same takeoff record, so nothing is lost.
- Then log in with the QA account at 390px, walk Roof card to takeoff to review, and confirm one layout end to end and no duplicated items.

No section content, wording, or ordering changes in this pass — the sectioned sheet is already the layout you want.

## 2. Placing a hip and a valley right next to each other

On the measurement screen the corner magnet is too grabby, so a point you want just beside a corner gets pulled onto it.

- Shrink the magnet radius so only a genuinely close tap snaps to a corner or another line's endpoint.
- Snap once, then let go: after a point has snapped during a drag, moving it away releases it and it stays exactly where your finger is — it will not re-snap to the next nearest corner for the rest of that drag. Lift and start a new drag to snap again.
- Straight-line (horizontal / vertical) snapping is unchanged.

## Technical notes

- `src/routes/cb.job.$id.scope.tsx`: roof card `to` becomes `/cb/job/$id/takeoff`.
- `src/routes/cb.job.$id.roof.tsx`: replaced with a `beforeLoad` redirect to `/cb/job/$id/takeoff`; the checklist UI and its `useCbCatalog("roof")` list are deleted.
- `src/components/cb/CbRoofPlanEditor.tsx`: lower `VERTEX_MAGNET_PX` (22 to about 12) and add a per-drag "magnet released" flag set in `beginPointDrag` / `beginVertexDrag` once the pointer moves beyond the magnet radius after a snap; while set, `magnetPoint` is skipped for that drag.
- No changes to measurement math, the estimate, report, or any GlobalContractor screen.
