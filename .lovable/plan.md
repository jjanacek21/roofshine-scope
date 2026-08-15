# Tablet fixes for the roof measurement screen

Two fixes on the Claim Buddy measurement screen (`/cb/job/:id/measure`), tablet and phone. No logo or color changes.

## 1. Drag line points like perimeter corners

Today only the footprint corners can be dragged. Line points (ridge, hip, valley) and measurement pins are tap-placed and cannot be nudged.

- Reuse the existing corner-drag gesture (44px hit target, pointer capture, map drag-pan disabled, magnifier loupe, angle snapping) for:
  - points of the line currently being drawn — press and hold a point, slide it to the exact spot, release
  - endpoints of already-drawn lines when a line is selected, so a saved ridge can be corrected without deleting it
  - measurement pins — press and hold a pin to reposition it before measuring
- Press-and-hold (~250ms) starts the drag so a normal tap still adds a point / selects a line.
- Live length readout updates while dragging; the value is committed on release, so Undo steps back one drag.
- Endpoints snap to a nearby perimeter corner or another line endpoint when within a few pixels, so ridges land exactly on the roof edge.

## 2. Undo button no longer sits under the Mapbox logo

The bottom drawing bar ("Undo point", "Finish line", "Done drawing") overlaps the Mapbox logo and attribution in the bottom-left, so taps open mapbox.com.

- Lift the drawing bar above the attribution strip and push the Mapbox logo/attribution to the bottom-right corner of the map, below the bar.
- Give the bar an opaque background and its own tap layer so nothing underneath it can receive touches.
- Same treatment for the hint pill at the bottom center.

## Technical notes

- All changes are in `src/components/cb/CbRoofPlanEditor.tsx`: generalize `beginVertexDrag` into a shared pointer-drag helper parameterized by drag target (section vertex, draft point, line endpoint, measure pin), and render DOM handles for draft/line points the same way vertex handles are rendered today.
- Marker repositioning uses the existing `pinMarkersRef` markers with `draggable`-equivalent pointer handling so behaviour matches the corner handles.
- Control placement uses Mapbox `attributionControl`/`logoPosition` plus z-index and bottom offsets on the overlay toolbars.
