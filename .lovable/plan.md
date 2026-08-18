# Measurement screen — four fixes

Scope: the Claim Buddy measurement screen only (`cb.job.$id.measure.tsx`, `CbRoofPlanEditor.tsx`, and the measure/footprint server code it calls). No GlobalContractor screen is touched.

## 1. Bring back the filled highlight

The editor already defines a `fill` layer for the measured polygon, but it only paints once the GL layer set finishes initializing, and when that init half-fails there is no visible fill at all — which matches what you're seeing.

- Guarantee the fill exists: verify the fill layer and its source survive style reloads, and re-assert layer order so the fill is never buried under the satellite labels layer.
- Raise the fill so it reads as "this area is counted": semi-transparent structure colour with a solid bright outline, plus a stronger tint for the section you're actively editing.
- Repaint on every geometry change, including mid-drag, so the fill follows the corner while your finger is still down (today the fill only refreshes when a drag commits).
- Add a visible fallback: if the GL layers genuinely fail to come up, draw the same fill as a map-anchored overlay rather than showing an empty map.

## 2. Keep lines pinned to the roof

Committed geometry is already map-bound, but the in-progress drawing (the draft line and its length labels) is drawn in screen space and only re-projected on the map's `move` event, so it lags and slides during pan/zoom momentum and does not update on rotate/pitch.

- Move the draft line, its points and its length chips into the map layers (real lat/long), same as finished lines.
- Any overlay that must stay in HTML (drag handles, loupe) re-projects on `move`, `zoom`, `rotate`, `pitch` and `render` so handles track the roof frame-for-frame.

## 3. Right house, and no endless "Measuring…"

Two separate problems at 2796 NE 4th Way:

- Footprint matching: the cached lookup returns the *nearest* building, which on a tight lot is the neighbour. Tighten it — only accept a ring the pin actually falls inside, or (if none contains the pin) a ring whose centroid is within a small distance of the pin; otherwise report "no footprint here, move the pin" instead of silently grabbing the neighbour. Shrink the search radius so a neighbouring structure is not even a candidate.
- Geocode choice: when the job address geocodes to a rooftop-ambiguous point, centre the map on it but never auto-measure from it — the measured point is always the pin you dropped.
- The hang: put a hard time budget on the whole measure call (footprint lookup, extraction, vision trace) with per-step timeouts, so it always resolves. On timeout or no-footprint the screen exits the "Measuring…" state and shows a clear message with retry, instead of spinning forever.

## 4. Grab the pins, and reach Undo

Several of these guards exist but are incomplete on touch.

- Keep `touch-action: none` on the map canvas and on every handle while editing (already partly there); add it to the draft-point handles too.
- On `pointerdown`, capture the pointer on the handle and hold it until `pointerup`/`pointercancel`; ignore `pointercancel` triggered by the map's own gesture handling.
- Disable map drag-pan, rotate, zoom and touch-zoom-rotate for the duration of a vertex/pin drag, then restore exactly the handlers that were enabled before.
- Remove the remaining source of mid-gesture resets: handle elements must not be unmounted or re-created while a drag is live (position updates only, stable identity), including when the plan geometry changes under the drag.
- 44px invisible hit target around every handle — corners, midpoints, pins and line endpoints (corners/midpoints have it; pins and line endpoints get it too).
- Magnifier loupe: appears on press-and-hold for any handle type, follows the finger, shows the live map under the fingertip with a crosshair at the exact grabbed point, and is offset above the finger so it is never covered.
- Undo: move the "Undo point" control out of the bottom-right corner where it collides with the Mapbox logo — the drawing action bar sits above the logo strip, and the logo moves to the bottom-left so no control shares space with it.

## Verification

Drive the measurement screen at 390px with touch emulation and confirm, with screenshots: the fill is visible on the roof, it stays registered to the building through pan/zoom, a continuous vertex drag moves the corner without resetting, and the Undo control is tappable without opening mapbox.com.

## Technical notes

- Files: `src/components/cb/CbRoofPlanEditor.tsx` (layers, handles, loupe, undo placement), `src/routes/cb.job.$id.measure.tsx` (measuring state, timeout/error surface), `src/lib/footprint.server.ts` (containment-first matching, radius), `src/lib/cb-measure.server.ts` (time budget per pin, explicit failure reasons).
- No schema changes.
