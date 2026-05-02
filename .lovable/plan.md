# Fix: map doesn't move when selecting an address

## Root cause

In `src/routes/_app.leads.wizard.tsx`, the "fly to selected lead" effect bails out when the lead has no `lat`/`lng`:

```ts
if (!mapRef.current || !selectedLead?.lat || !selectedLead?.lng) return;
```

Most imported leads don't have coordinates yet, so picking them does nothing. The lead detail sheet already solves this with an on-demand call to the existing `geocodeLead` server function — the wizard just isn't using it.

## Changes

**File: `src/routes/_app.leads.wizard.tsx`**

1. Import the existing geocoder:
   ```ts
   import { geocodeLead } from "@/server/leads.functions";
   ```
   and wrap with `useServerFn(geocodeLead)`.

2. Add local state for the resolved coordinates so the map updates immediately without waiting for `useLeads` to refetch:
   ```ts
   const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
   const [locating, setLocating] = useState(false);
   ```

3. Rewrite the "fly to selected lead" effect:
   - When a lead is picked, reset pins/measurements/analysis as today.
   - If `lead.lat` and `lead.lng` exist → `flyTo` immediately and store them in `resolvedCoords`.
   - Otherwise set `locating = true`, call `geocodeLead({ leadId })`, and on success store the returned coords + `flyTo`. On failure show a toast (`"Couldn't locate this address — drop pins manually."`).
   - Guard against race conditions: capture the current `selectedLeadId` and ignore the result if the user picked a different lead in the meantime.

4. Update the `center` memo so it falls back to `resolvedCoords` (then `selectedLead.lat/lng`) when there are no pins. This way "Get measurements" works on a freshly-geocoded lead even before `useLeads` refetches.

5. UI feedback: when `locating` is true, show a small `"Locating address…"` row with a spinner under the lead picker, and disable the "Get measurements" / "Analyze" buttons while locating.

6. Also invalidate the `["leads"]` query after a successful geocode so the dropdown's "no coords" hint disappears for that lead.

## Out of scope

- Changing `geocodeLead` itself — it already updates the DB and logs an activity.
- Reverse-fitting the map to a bounding box of pins (current `flyTo` zoom 19 stays).
