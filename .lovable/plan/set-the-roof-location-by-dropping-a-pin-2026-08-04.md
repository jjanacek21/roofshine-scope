# Set the roof location by dropping a pin

When Mapbox geocoding puts a job at the wrong spot (or finds nothing), the Measure screen should let you pan a satellite map, drop a pin on the actual house, and save that as the property's location so every measurement tool re-centers there.

## What gets added

**"Set location" control on the Measure screen**
- A small bar above the measurement tabs showing the current coordinates and a "Wrong location? Set it on the map" button.
- If the property has no coordinates at all, this bar is shown prominently instead of the disabled tabs, so the screen is usable right away.

**Location picker**
- Full-width satellite map (same Mapbox satellite style used elsewhere).
- Starts at the current property coordinates, or the job's city/zip area, or a wide default when nothing is known.
- Address search box at the top (reuses the existing address autocomplete) to fly close, then pan/zoom manually.
- Click anywhere to drop/move a pin; the pin is draggable. Live coordinate readout.
- "Save location" writes lat/lng to the property record; "Cancel" discards.

**After saving**
- The property record's lat/lng (and optional reverse-geocoded address, only if the address field is empty) is updated.
- The Measure screen refreshes and the Mapbox Draw, AI Measurements, and AI Condition tabs all become enabled and centered on the new pin, so the satellite imagery is now the correct house.
- Existing saved measurements are not deleted; a note reminds you to re-run AI measurements after moving the location.

## Technical notes

- New component `src/components/roof/PropertyLocationPicker.tsx`: Mapbox GL satellite map, draggable marker, uses `useMapboxToken` and `AddressAutocomplete`.
- `src/components/roof/RoofMeasurementPanel.tsx`: add the location bar + picker; on save, update `properties.lat/lng` via Supabase and invalidate `["job-property", propertyId]`, `["roof-measurement", propertyId]`.
- `src/routes/_app.jobs.$id.measure.tsx`: stop early-returning the "no linked property" empty state when coordinates are missing — pass `center: null` through so the picker can be used (it already does this; only the tab-disabled path changes).
- No changes to measurement math, AI extraction, or storage schema.
