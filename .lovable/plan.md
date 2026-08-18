# Measurement screen: break edges at dropped points, and snap while drawing

All of this is on the roof measure screen, in `src/components/cb/CbRoofPlanEditor.tsx` (plus two small helpers in `src/lib/cbRoofPlan.ts`). Nothing else is touched.

## What happens today

- Dragging a blank midpoint dot does insert a corner, and the new corner does split that perimeter edge — but both halves inherit the label of the original edge, so the whole bottom still reads as one continuous eave run.
- A drawn line endpoint snaps visually onto the perimeter, but it does **not** put a corner there. The perimeter is still one long segment underneath, so tapping it to label paints the entire bottom of the roof blue.
- Corner drags snap to 15-degree increments off the neighbouring corner, and only snap to a right-angle axis when "Square up" is switched on. There is no snapping to another corner, and no automatic horizontal/vertical snap.

## The fix

### 1. A dropped point really breaks the edge

- When a line endpoint (drawn line or draft point) lands on a perimeter edge within the snap radius, insert a real corner into that section's ring at that spot. The edge becomes two edges that can each be labelled on their own.
- When a corner is inserted by any route (midpoint drag, refine tap, line endpoint), the two resulting halves are labelled independently: the half you later tap is the only one that changes colour. New halves start unlabeled instead of copying the parent label, so a bottom run can be eave / rake / rake / eave.
- Splitting only ever adds a corner — it never moves the outline or changes the measured area.

### 2. Corner-to-corner snapping

While dragging a corner or a line point, if it comes within about 16 px of another corner, another drawn line's endpoint, or a corner on a neighbouring structure, it snaps exactly onto that point (with a short haptic tick). Two shapes that should meet meet cleanly.

### 3. Automatic straight snapping

Snapping to horizontal / vertical (and to the roof's dominant axis, so rotated houses behave) happens always, not only under "Square up". While dragging, if the edge from the previous corner is within roughly 6 degrees of straight, it locks to straight. The same rule applies to the point you are about to place while drawing a line, so ridges and hips come out straight instead of a degree off.

### 4. Snap to the perimeter when close

The existing perimeter snap for line points is kept and widened slightly, and it now also fires mid-drag (not only on the initial tap). Combined with item 1, dropping a ridge endpoint near the outline both lands it exactly on the outline and breaks the outline there.

## Technical notes

- `src/components/cb/CbRoofPlanEditor.tsx`: extend `snapLinePoint` to return which section/edge was hit; add a `splitEdgeAt(sectionId, edgeIndex, point)` helper used by the midpoint drag, `refineTap` and line-point placement/drag; change the edge-array splice so inserted halves are `"unlabeled"`; add a vertex-magnet pass over all section rings and line coords; call the axis snap unconditionally in both `beginVertexDrag` and `beginPointDrag`.
- `src/lib/cbRoofPlan.ts`: `snapVertex` gains an always-on 0/90 (axis-relative) snap alongside the existing 15-degree rule; `nearestPointOnRing` also reports the segment index so the caller can split there.
- No changes to measurement math, totals, the takeoff/estimate screens, colours or the logo.

Verification: on the measure screen, drop a point mid-way along the bottom edge, label one half eave and the other rake, and confirm only that half changes colour; drag a corner next to another corner and confirm it clicks onto it; drag a corner near horizontal and confirm it locks straight; draw a ridge with an endpoint near the outline and confirm it lands on the outline and breaks it there.
