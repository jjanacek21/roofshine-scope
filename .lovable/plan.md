## Goal
Add a "Map" tab to the Roof King section that plots every service ticket as a pin on a satellite map, colored by status, so you can see at a glance where the work is concentrated.

## What it looks like
- New sub-nav item in Roof King: **Map** (globe/map-pin icon), sits between "All Tickets" and "SPF Calculator".
- Full-height split view (same feel as `/leads/map`):
  - Left: Mapbox satellite-streets map, one pin per ticket at the property's address.
  - Right: filter/legend sidebar with ticket count, status legend, time filter (All / 30d / 90d / 1y), and a "Geocode N missing" button when properties lack coordinates.
- Pins colored by `RK_STATUS_COLORS` (new/dispatched/field/ready/invoiced).
- Click a pin → popup with WO#, customer, building, service date, status, price, and a "Open ticket" button that opens the existing `TicketDrawer`.
- Multiple tickets at the same property cluster into one pin with a count badge; clicking expands a list.
- Empty-state card when no tickets have coordinates yet, with a one-click Geocode action.

## Data / backend
`rk_properties` doesn't currently store coordinates, so tickets can't be plotted. One small migration:
- Add `lat double precision` and `lng double precision` columns to `rk_properties`.
- No policy changes (existing RLS already covers the table).

Geocoding uses the same pattern as `/leads/map`: browser calls Mapbox Geocoding API with the token from `useMapboxToken`, batched at concurrency 5, writes `lat`/`lng` back to `rk_properties`. Runs on-demand from the sidebar button (not automatically). Also auto-geocodes when a new property is created via `AddCustomerDialog` / `NewTicketDialog` in a follow-up (optional; can be added later).

## Files to add / change
- **Migration**: add `lat`, `lng` columns to `rk_properties`.
- **New**: `src/routes/_app.roofking.map.tsx` — the map page (mirrors `_app.leads.map.tsx` structure but sourced from RK tickets + properties, and reuses `TicketDrawer`).
- **Edit**: `src/lib/roofking/types.ts` — add optional `lat`/`lng` on `RKProperty`.
- **Edit**: `src/routes/_app.roofking.tsx` — add the new "Map" tab entry to `TABS`.

Nothing else in the Roof King section changes. GCN branding, estimates, reports, and the rest of the app are untouched.

## Out of scope (call out if you want them)
- Heatmap / density overlay (pins + clustering only for now).
- Automatic geocoding of every new property on creation.
- Drawing service territories on the map.
