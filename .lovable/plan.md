Plan to fix the roof drawing behavior:

1. Make labeled lines visibly change color immediately
   - Store the label on the exact property Mapbox Draw styles are reading, so hips/ridges/valleys/flashings repaint as soon as the label is saved.
   - Keep unlabeled lines neutral/white so labeled vs unlabeled lines are obvious.

2. Connect new lines to existing pins instead of stacking duplicate pins
   - When drawing a line near an existing perimeter or line vertex, snap the clicked point to that exact coordinate.
   - Deduplicate snap targets so clicking the same existing pin does not create multiple visible dots in the overlay.
   - Keep the snap preview halo to show which pin will be reused before the click lands.

3. Prevent accidental perimeter splitting completely
   - Remove Mapbox Draw midpoint features from the rendered style with a stricter filter so hidden midpoint handles cannot still receive clicks.
   - Add a defensive cleanup pass after draw updates: if Mapbox Draw still inserts a vertex into an existing polygon edge from an accidental midpoint click, collapse that extra vertex back out when it matches a midpoint insertion pattern.
   - Keep real user-dropped perimeter vertices intact; only midpoint-style accidental inserts are removed.

4. Make perimeter segment labeling safe
   - Keep perimeter segment hit-testing active only in Label mode.
   - In Label mode, clicking the colored/blue perimeter overlay should open the label prompt only; it should not edit geometry or add a vertex.
   - Perimeter labels continue to support all edge types, not just eaves/rakes.

5. Update toolbar copy to match the corrected workflow
   - Remove the old hint about dragging midpoints to add corners.
   - Clarify that line drawing snaps to existing dots/pins.

Technical files to update after approval:
- `src/components/roof/MapboxRoofDraw.tsx`
- `src/lib/mapbox-draw-styles.ts`
- `src/components/roof/DrawToolbar.tsx`