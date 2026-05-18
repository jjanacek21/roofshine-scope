## Plan

1. **Add persistent label mode**
   - When the user clicks **Label**, show edge-type choices directly in the toolbar/palette.
   - Selecting **Eave**, **Rake**, **Ridge**, etc. keeps that label active so every clicked segment gets that type immediately.
   - No dialog after every line; user can label all eaves, then switch to rakes, ridges, etc.

2. **Label only the segment between two pins**
   - Convert drawn interior lines from “one label for the whole polyline” to **per-segment labels**, just like perimeter edges.
   - Clicking a line in label mode will determine the closest segment between two consecutive points and label only that segment.
   - Render a visible colored overlay for each labeled segment, so hips/ridges/valleys change color independently even if they are part of the same drawn line.
   - Update totals so each labeled segment contributes to the correct edge type length.

3. **Keep perimeter behavior segment-based**
   - Reuse the same active edge type for perimeter segments.
   - Clicking a perimeter segment labels only that segment and does not open the old prompt.
   - Keep the perimeter split prevention in place and avoid entering polygon edit mode while labeling.

4. **Fix duplicate pins when connecting lines**
   - Include both perimeter vertices and existing interior line vertices as snap targets while drawing.
   - Before saving/updating a line, normalize each clicked coordinate to the exact existing pin if it is within snap distance.
   - Dedupe displayed vertex dots by coordinate so connected endpoints show as one pin, not stacked pins.

5. **Update toolbar hints and state**
   - Make the UI clearly show the currently active edge type.
   - Keep Select/Line/Polygon/Point tools working as they do now, but Label mode becomes a fast “paint labels onto segments” workflow.