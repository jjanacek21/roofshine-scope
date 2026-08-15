# Exterior and interior takeoffs — where they went, and how to finish them

## What's actually in the app right now

Nothing was deleted. Here is the current state, confirmed in the code:

- **Roof walk** (`/cb/job/:id/roof`) is the 4-step wizard: roof system, slopes and damage, then a button that sends you to the standalone takeoff sheet. The takeoff was never rendered *inside* the walk — the last step just links out to it.
- **Takeoff sheet** (`/cb/job/:id/takeoff`) still exists and is fully intact: roof system, flashing, ventilation with the NFA calc, penetrations, skylights, solar, gutters, hardware. It is roof-only by design — there are no exterior or interior sections in it.
- **Exterior walk** (`/cb/job/:id/exterior`) is still just: wide shot per elevation, damage checklist, next elevation. No takeoff lines (siding, windows, screens, fascia/soffit, gutters per elevation, AC fins, fence).
- **Interior walk** (`/cb/job/:id/interior`) is rooms with moisture readings and photos. No takeoff lines (ceiling/wall sqft, flooring, drywall, insulation, contents).
- **Scope screen** still shows "Open the roof takeoff sheet" as a separate button.

So: exterior and interior takeoffs were never built. Only the roof got one, and it lives on its own screen instead of inside the walk.

## What I'd build

### 1. Roof takeoff inside the walk
Render the takeoff sections as step 3 of the roof wizard instead of a link out. Same fields, same saving, camera button on each line. The standalone route stays for editing later.

### 2. Exterior takeoff, per elevation
After the damage checklist on each elevation, add a takeoff step with quantity-or-photo lines:
siding (type, sqft), windows and screens, doors, fascia LF, soffit LF, gutters and downspouts LF, shutters, light fixtures, AC condenser fins, fence LF, wraps and detached structures.

### 3. Interior takeoff, per room
After moisture and photos in each room, add: ceiling sqft, wall sqft, flooring type and sqft, baseboard LF, drywall damage, insulation, paint, and a contents note.

### 4. Roll-up into review and estimate
Exterior and interior lines feed the review recap and the estimate line-item generator the same way the roof lines do, so a full-scope claim produces one complete list.

### 5. Scope screen cleanup
Drop the standalone takeoff button — the walk owns it now.

## Technical notes

- Extend `src/lib/cbSheet.ts` with `exterior` (keyed per elevation) and `interior` (keyed per room) section shapes, plus scoring entries so completeness reflects them.
- Extract the `Section` / `QtyLine` / `Picker` components out of `src/routes/cb.job.$id.takeoff.tsx` into `src/components/claim-buddy/CbTakeoffFields.tsx` so the walk routes and the sheet render identical fields.
- `cb.job.$id.roof.tsx`: replace the "Continue to roof takeoff" link with an inline step.
- `cb.job.$id.exterior.tsx`: add a `takeoff` mode between `damage` and `summary`.
- `cb.job.$id.interior.tsx`: add takeoff lines to the room editor.
- Persist everything in the existing `cb_takeoffs.data` / `.elevations` JSON — no schema change.
- `cb.job.$id.review.tsx` and `src/lib/cbEstimate.ts`: read the new sections when building the recap and line items.
