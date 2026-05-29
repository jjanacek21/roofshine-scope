Plan to fix the Door-to-Door map pins:

1. Restore visible property dots, but not the bad random grid
   - Re-enable automatic map dots in a smarter way: one dot per detected/known property location, not a square coordinate grid.
   - Do not create dozens of offset dots around the same house.
   - Keep the orange hollow style for untouched houses/buildings, and filled disposition colors after a status is selected.

2. Build pins from real map/building data instead of arbitrary coordinates
   - Use Mapbox features in the visible map area to identify actual buildings/addresses where possible.
   - Generate a single clickable marker centered over each detected house/building footprint.
   - Deduplicate nearby features so one single-family house gets one dot.
   - If a building is already saved as a disposition, keep the saved disposition and position.

3. Support duplex / multi-unit exceptions
   - If separate units are present as separate imported addresses or user-added records, allow more than one dot for that same building.
   - Otherwise default to one dot per building/property.

4. Show address, not coordinates, when clicking a dot
   - When a pin has a saved/imported address, show that address immediately.
   - When a pin is map-detected only, reverse-geocode the pin on click and pass that address into the disposition panel.
   - Save the resolved address with the disposition so it stays attached next time.

5. Keep click behavior simple
   - Clicking a dot opens the existing disposition menu/panel.
   - Clicking blank map can still add a property only when the session is active, but the main workflow should be clicking the dot over each house/building.

Technical notes:
- Update `src/components/door-to-door/DoorToDoorMap.tsx` to add a separate generated-building marker source/layer based on visible Mapbox data and merge it with saved `property_dispositions`.
- Update `src/pages/DoorToDoor.tsx` so map clicks/pin clicks can pass a resolved address into `setPropertyDisposition`.
- Keep the coordinate text removed from `PropertySidePanel`; it will continue showing address / looking up address.
- Avoid another database cleanup unless needed; the previous empty grid records were already deleted.