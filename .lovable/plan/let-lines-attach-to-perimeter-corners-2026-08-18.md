# Let lines attach to perimeter corners

## The problem

On the measurement screen, once the footprint is saved and you switch to drawing lines, tapping directly on an orange corner dot does nothing — no point is dropped there. So a hip or valley that must run out to a roof corner can't be finished at that corner.

Confirmed cause: the corner dots and blank edge dots are HTML buttons sitting on top of the map with a 44px touch area. Their press handler stops the event, so while the line tool is active the tap is consumed as "start dragging this corner" and never reaches the map, which is what actually adds a line point. The snapping code that would land the point exactly on the corner already exists — it just never runs, because the tap never gets there.

## The fix

While the line tool is active:

- Corner dots and blank edge dots stop intercepting taps, so a tap anywhere — including right on a corner — reaches the map and drops a line point. The dots stay visible as targets to aim at.
- A tap near a corner or another line's endpoint snaps to exactly that coordinate, so the hip/valley truly shares the corner point instead of sitting a few inches off. Snap radius is widened from 16px to about 22px so a fingertip on a phone reliably grabs the corner rather than the edge next to it.
- A tap near an edge (not near a corner) keeps today's behavior: it lands on the edge and splits it there.
- A locked/saved footprint stays locked — dropping a line point on an existing corner does not move, reshape, or unlock the footprint.

Corner dragging still works normally in every other tool (select, refine, label), so nothing about reshaping the footprint changes.

## Technical detail

`src/components/cb/CbRoofPlanEditor.tsx`:
- Gate the `vertexHandles` and `midHandles` buttons' `pointer-events` (and their `onPointerDown`) off when `tool === "line"`; keep them rendered for visual reference.
- Raise `VERTEX_MAGNET_PX` from 16 to 22 and make `snapLinePointInfo` prefer a corner/endpoint magnet over an edge projection (it already does; the widened radius makes it win in practice on touch).
- No change to `splitEdgeAt`, commit/undo, or the locked-section rules; a magnet hit returns `hit: null`, so no edge split fires when the point lands on a corner.

No other screens, features, or styling touched.
