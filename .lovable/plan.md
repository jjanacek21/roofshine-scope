## Goal
Make the Roof King service-ticket map behave like a proper zoomable service map:
- Zoomed out: show clustered bubbles with the number of tickets/properties in that area.
- Zooming in: clusters break apart into pins.
- Street/house zoom: pins sit directly over the actual property, not offshore or in the wrong city.

## What I confirmed
- The map is currently rendering one custom marker per property/ticket group, so zoomed-out markers overlap instead of clustering cleanly.
- The database has coordinates for most properties, but some saved coordinates are clearly wrong because earlier geocoding accepted incomplete addresses like `2570 and 2580`, `PH 10`, `Bldg 2`, or bare unit/building text.
- There are 280 properties with coordinates; 39 are outside the South Florida bounding area, including several bad matches in Orlando, Puerto Rico, North Dakota, Michigan, etc.

## Implementation plan
1. **Replace manual marker rendering with Mapbox clustering**
   - Build a GeoJSON source from the filtered tickets/properties.
   - Enable Mapbox `cluster: true`.
   - Show numbered cluster circles when zoomed out.
   - Show individual status-colored property pins when zoomed in.
   - Clicking a cluster zooms into that area.
   - Clicking a pin opens the existing ticket popup.

2. **Stop showing obviously bad coordinates as valid pins**
   - Exclude coordinates that are outside a reasonable Florida/service-area sanity check unless the address itself clearly belongs outside South Florida.
   - This prevents bad geocodes from appearing offshore or in unrelated cities.

3. **Tighten the re-geocoding action**
   - Only geocode addresses with a real street/address signal.
   - Use the property city/state/zip to bias results.
   - Reject low-confidence or out-of-area results.
   - Add a safer “fix bad pins” path that re-geocodes rows with suspicious coordinates.

4. **Improve the sidebar feedback**
   - Show counts for:
     - tickets shown
     - properties shown
     - properties skipped because coordinates are missing or suspicious
   - Keep the re-geocode button, but make its result clearer.

5. **Verify in preview**
   - Open `/roofking/map`.
   - Confirm clusters appear when zoomed out.
   - Confirm clusters split into property pins when zooming in.
   - Confirm popups still list tickets for the clicked property.

## Technical notes
- Main file to update: `src/routes/_app.roofking.map.tsx`.
- This should be a frontend map rendering/data-validation change, with no schema changes required.
- If needed after the UI fix, I can run a separate approved data cleanup to clear/re-geocode the already-bad coordinates.