# Use the jobs measurement widget in Claim Buddy

## Confirmed issue

- The GlobalContractor job flow renders `SolarRoofTab`, where roof pins, the persistent **AI measurements** button, loading state, traced facets, multi-structure support, and retry controls all live in one widget.
- Claim Buddy currently duplicates that workflow across `CbRoofPlanEditor` and the route page. Its **Measure pinned roof** button only renders while the page phase is `idle`.
- Loading an existing manual Claim Buddy measurement changes the phase to `manual`, so dropping a pin can leave the user with no nearby measurement action. The retry action is separated from the map and appears after the full manual form.

## User experience

1. Replace Claim Buddy’s separate pin controls with the same `SolarRoofTab` measurement widget used by the jobs workflow.
2. Keep **AI measurements** visible directly above the map whenever one or more roof pins exist.
3. Allow one pin per structure, then measure the house, shed, garage, or all pinned roofs exactly as the jobs workflow does.
4. Show the returned perimeter, facets, pitches, totals, loading state, failures, retries, and clear controls in that same widget.
5. After a successful measurement, continue into Claim Buddy’s existing roof-plan editor for edge labels and manual corrections.
6. Preserve Claim Buddy styling around the shared widget and keep manual entry as an explicit fallback only.

## Technical implementation

- Refactor `SolarRoofTab` only enough to accept an optional persistence/adapter callback; its existing GlobalContractor behavior remains the default and unchanged.
- Add a Claim Buddy adapter that supplies the linked shared property/company context and routes measurement persistence through the existing authenticated Claim Buddy server function, avoiding assumptions from the GlobalContractor profile/job model.
- Render the shared `SolarRoofTab` from the Claim Buddy measurement route instead of maintaining separate `measurePins`, `pinDropMode`, and route-level run controls.
- On successful measurement, reload `cb_measurements` and the saved `roof_sections`, update Claim Buddy totals, and open the existing `CbRoofPlanEditor` with the traced facets.
- Remove the now-redundant Claim Buddy pin toolbar path so there is one measurement interaction and no hidden phase-dependent button.
- Do not alter GlobalContractor screens, branding, logos, or colors.

## Verification

- Test at 390×844: drop a roof pin and confirm **AI measurements (1)** remains visible and tappable without scrolling through manual fields.
- Add a second structure pin and confirm the shared widget measures both.
- Run the Boca Raton test property through both surfaces with identical coordinates and compare facet rings, facet count, plan area, pitch-adjusted area, and squares.
- Confirm Claim Buddy displays the traced multi-facet roof, never inserts a rectangle, and preserves the result after reload.
- Confirm the existing GlobalContractor job measurement flow behaves exactly as before.