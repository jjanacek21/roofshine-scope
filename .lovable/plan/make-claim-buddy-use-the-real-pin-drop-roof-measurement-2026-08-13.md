# Make Claim Buddy use the real pin-drop roof measurement

## Confirmed cause

- The GlobalContractor workflow listens for a map click in `SolarRoofTab`, creates a pin at that exact latitude/longitude, and sends that pin to `/api/solar-roof-extract`, which calls `runSolarRoofExtract` and returns traced facets.
- Claim Buddy’s roof map has no measurement-pin click mode. In normal mode, a map tap only selects an existing shape; it never starts a measurement.
- Claim Buddy’s `Get instant measurement` button measures the job’s saved address coordinates, not a point tapped on the roof.
- Claim Buddy’s `+ Structure` action explicitly creates a 30-foot square at the map center with a default 6/12 pitch. That is the 1,006 sq ft orange rectangle shown in the phone screenshot.
- The current Boca Raton Claim Buddy record is saved as manual and its linked shared roof measurement has zero roof sections, confirming that no traced engine geometry reached the plan.

## User experience

1. Replace `+ Structure` as the primary action with a clear **Drop measurement pin** mode.
2. In that mode, tapping the satellite roof places a visible pin at the tapped coordinates and enables **Measure pinned roof**.
3. Run the same `runSolarRoofExtract` engine used by GlobalContractor using the tapped coordinates—not the address/geocoder coordinates.
4. Display every returned facet as its own editable polygon, including the real perimeter and internal facet boundaries.
5. Fit the map to the returned roof geometry and refresh totals from those facets.
6. Keep manual entry available only as an explicit fallback. Never create a rectangle automatically or represent it as an AI result.
7. Support additional buildings by allowing another pin for a shed/garage and combining all successfully traced facets into the saved measurement.

## Implementation

- Add measurement-pin state and tap handling to the Claim Buddy roof editor, while preserving existing vertex/edge editing after geometry is returned.
- Pass the selected pin coordinates from the Claim Buddy measure route into its measurement request.
- Update the Claim Buddy server measurement path to accept the selected structure pins, call the shared extraction engine for each pin, reject empty geometry, combine valid facets, and persist them together through the shared roof-measurement save helper.
- Reload the saved roof plan after measurement and ensure the editor renders the returned `roof_sections` without converting them to a hull, bounding box, or square.
- Remove the 30-foot `squareRing` structure action from this flow. If satellite coverage fails, show the precise failure and offer manual entry/tracing without inserting placeholder geometry.
- Keep credit metering behavior unchanged.

## Verification

- On a 390×844 mobile viewport, open the Claim Buddy Boca Raton job, activate pin mode, tap the roof, and confirm the pin lands where tapped.
- Run `3844 Northwest 4th Court, Boca Raton, FL 33431` through both the GlobalContractor pin path and Claim Buddy using the same coordinates.
- Compare engine facet count, rings, plan area, pitch-adjusted area, and squares before UI rendering; they must match for the same input.
- Confirm the Claim Buddy map shows the traced multi-facet outline and internal boundaries, with no 1,006 sq ft rectangle.
- Add a second pin and confirm both structures persist after reload.
- Confirm a no-coverage response creates no geometry and leaves manual entry available.