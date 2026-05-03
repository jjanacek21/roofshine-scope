## Problem

In the AI Roof Wizard (`/_app/leads/wizard`), the "address" picker only filters the in-memory list of existing leads — it cannot find any address that isn't already saved as a lead. On top of that, when a selected lead has no `lat/lng`, it calls the `geocodeLead` server function, which is the same function that has been failing with a server-runtime error (the same one we already routed around in `LeadDetailSheet` by switching to a client-side Mapbox call).

Result: typing a new address returns "No leads found", and even picking an existing lead with a missing coord often errors out instead of locating the roof.

## Fix

Replace the lead-only combobox with a hybrid picker that searches both existing leads AND any real-world address via the Mapbox forward-geocoding API, and remove the broken `geocodeLead` server-fn dependency.

### Changes to `src/routes/_app.leads.wizard.tsx`

1. **Add Mapbox address autocomplete**
   - Add a debounced effect (~250 ms) on the `CommandInput` value.
   - When the query is ≥3 chars, fetch from `https://api.mapbox.com/geocoding/v5/mapbox.places/{q}.json` using the existing `useMapboxToken()`, with `country=us`, `types=address`, `autocomplete=true`, `limit=5`.
   - Render Mapbox results in a new `CommandGroup` titled "Search results" above the existing "Leads" group.
   - Selecting a Mapbox result sets a new local `manualPlace` state `{ lat, lng, address }`, clears `selectedLeadId`, flies the map to that point, and lets the user drop pins / run measurements / run analysis just like a selected lead.

2. **Drop the broken `geocodeLead` call**
   - Remove the `geocode` server-fn import and the `geocode({ data: { leadId } })` flow.
   - When a lead with no `lat/lng` is picked, geocode client-side with the same Mapbox forward-geocoder using `${address}, ${city}, ${state} ${zip}`.
   - On success, also update the lead row directly: `supabase.from("leads").update({ lat, lng }).eq("id", lead.id)` and invalidate the `leads` / `lead` queries — same pattern already used in `LeadDetailSheet.tsx`.
   - Surface "Address not found — drop pins manually" as a toast when Mapbox returns zero features.

3. **`center` / "save to lead" wiring**
   - `center` falls back to `manualPlace` when no lead is selected and no pins are dropped.
   - `runAnalysis` keeps passing `leadId: selectedLeadId || undefined`, so manual-address analyses simply don't auto-save (matches today's behavior for unsaved searches). The "Saved to lead automatically" hint already gates on `selectedLeadId`.

4. **UI polish**
   - Show a small `Loader2` next to the CommandInput while the Mapbox lookup is in flight.
   - Show "No matches" when both lead filter and Mapbox return empty.
   - When `manualPlace` is active (no `selectedLead`), display the resolved address + lat/lng in the sidebar where the "city, state · sqft on file" line currently shows.

### Files

- `src/routes/_app.leads.wizard.tsx` — all of the above (single-file change).

No backend, schema, or other route changes are needed. The Mapbox token already comes from the existing `/api/mapbox-token` server route via `useMapboxToken()`.
