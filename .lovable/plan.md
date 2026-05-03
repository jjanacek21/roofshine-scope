## Goal

From the Lead Details sheet, add a **Generate Report** button directly under the satellite view that opens the AI Roof Wizard already focused on the property's address — satellite map, pin-drop, pan/zoom, measurements, and AI analysis all available in one flow.

## Changes

### 1. `src/components/leads/LeadDetailSheet.tsx`
- Under the existing **Satellite View** section, add a primary **Generate Report** button (Sparkles icon).
- On click: navigate to `/leads/wizard?leadId={lead.id}` using TanStack Router's `useNavigate`. Closes the sheet.
- Disabled state with tooltip text "Locate address first" if the lead still has no coords *and* geocoding hasn't resolved (wizard can still geocode, but we keep the affordance honest).

### 2. `src/routes/_app.leads.wizard.tsx`
- Add a `validateSearch` to the route accepting optional `leadId: string`.
- On mount (and when leads finish loading), if `search.leadId` is present and matches a lead, call `setSelectedLeadId(search.leadId)` once. Existing `useEffect` for `selectedLead` then handles flying to the address, geocoding if needed, and resetting pins.
- No changes to map interaction — pan, zoom, pin-drop, measurements, and AI analysis already work.

### 3. UX polish in the wizard (small)
- When entered via `?leadId=`, scroll the wizard's right-side panel into view on small screens and show a short toast: "Loaded {address} — drop pins on roof sections to analyze."

## Technical Notes

- Route search validation:
  ```ts
  validateSearch: (s: Record<string, unknown>) => ({
    leadId: typeof s.leadId === "string" ? s.leadId : undefined,
  })
  ```
- Sheet button uses existing primary blue gradient styling consistent with other CTAs in the sheet (matches "Generate Report" PDF button already at line 353, but this one opens the wizard instead — name it **"AI Roof Report"** to avoid collision with the existing PDF generator).
- Navigation: `navigate({ to: "/leads/wizard", search: { leadId: lead.id } })` then call the sheet's `onOpenChange(false)`.

## Out of Scope

- No changes to measurement/analysis server functions.
- No new DB fields. Reports created from the wizard already persist via existing `analyzeRoofWithAI` flow.
