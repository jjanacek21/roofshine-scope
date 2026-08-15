# One sheet per elevation — merge the checklist and the takeoff

Today an exterior elevation makes you do the same walk twice: first the damage
checklist (tap item, two photos, qty, note), then a separate takeoff card with a
second list of quantities (siding, windows, fascia, soffit, gutter...). Same wall,
two screens, double entry.

## What it becomes

One list per elevation. Every row is a line you can act on in place:

```text
FRONT ELEVATION            1/4
[ Wide shot — 1 captured ]

SIDING
[x] Siding            SF  [ 420 ]  [photo 2]
[ ] Wraps / trim      EA  [    ]  [photo]

OPENINGS
[x] Windows           EA  [  6 ]  [photo 1]
[ ] Doors             EA  [    ]  [photo]
...

[ Complete front elevation → ]   (goes straight to Right)
```

- Tapping the checkbox marks that item as damaged on this elevation.
- Quantity is typed on the same row, in the item's unit.
- The camera button on the row shoots against that item (still runs the
  medium → close-up pair for damage items).
- One button at the bottom completes the elevation and moves to the next one.
  No "back to the checklist", no separate takeoff mode, no summary detour.

The single list is built by merging the two current sources so nothing is lost:
the damage catalog rows for the exterior scope, plus the takeoff fields
(siding, windows, screens, doors, fascia, soffit, gutter, downspouts, shutters,
light fixtures, A/C fins, fence, wraps, detached structures). Rows that mean the
same thing appear once. Siding type stays as a picker at the top of the
elevation; the notes box stays at the bottom.

## Roof and interior

The same merge is applied to the roof walk (one list per slope: hardware,
vents, penetrations, flashing quantities and damage in one pass) and the
interior walk (one list per room). Same interaction, same single completion
button.

## Technical notes

- New shared component `CbElevationSheet` replacing the `mode` state machine in
  `src/routes/cb.job.$id.exterior.tsx` (`choice` / `damage` / `takeoff` /
  `summary` all collapse to one screen).
- A merge layer maps each row to its storage target so the estimate engine keeps
  reading exactly what it reads today:
  - catalog rows → `cb_takeoffs.elevations[elev].items[item_key]` (qty, note,
    photo counts)
  - takeoff-field rows → `cb_takeoffs.data.sheet.exterior[elev][field]` (and the
    row's damage flag also written to `items` so it shows in the report)
  - Rows that map to both write both, so `cbEstimate.ts` needs no change.
- Photos keep their current meta (`category`, `elevation`, `item_key`,
  `shot_type`), so report grouping and the review screen are unaffected.
- Same merge helpers reused by `cb.job.$id.roof.tsx` and
  `cb.job.$id.interior.tsx`; `cb.job.$id.takeoff.tsx` stays reachable as a
  read/edit-everything sheet but is no longer part of the walk.
- No logo or color changes; existing Claim Buddy primitives only.
