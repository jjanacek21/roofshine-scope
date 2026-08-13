# Get Claim Buddy back to the prototype flow

The screens from your prototype video already exist (customer → cover → choose inspection → roof slopes → roof takeoff → exterior → interior → review takeoff → report → present → contingency). What broke is the way out of the inspection steps, and the measure screen changed more than you wanted. This fixes the flow first, then adds the pieces you called out.

## 1. Unblock the inspection phase (first, on its own)

- Photo saving silently does nothing when the job's workspace hasn't loaded yet — the "Use N photos" button closes nothing and no photo is recorded, so the wide shot never registers and the step can't advance. Fix: read the workspace from the job record already in context, keep the button disabled with a visible reason until it's ready, and show an error instead of failing quietly.
- Add an explicit "Skip this elevation / no photo" path on exterior, roof and interior so a rep is never trapped by a camera that won't open.
- Every inspection step gets an always-visible bottom action bar with Back and Continue, so progress never depends on reaching a summary state.

## 2. Undo the measure-screen takeover

Put the Claim Buddy measure screen back to the simple version: pin drop → "Instant measure" → result. Keep the GlobalContractor widget out of it. After the instant measure returns, the rep can:

- open the traced roof in the editable map view,
- drag corners to the real roof edges,
- add/remove corner points,
- label each line as eave, rake, ridge, hip, valley, step/wall flashing (sticky labels: pick the label once, tap all matching lines).

## 3. Multiple photos per section

Each checklist item and each section keeps a photo strip instead of one slot: add, review, re-caption and delete, with a count badge on the section. Applies to cover, elevations, slopes, test squares, interior rooms and takeoff items.

## 4. Takeoff → estimate, two modes

At the end of the takeoff, one screen with two buttons:

- **Priced estimate** — quantities from the takeoff and measurements, priced from the Xactimate price book already in the app.
- **Unpriced estimate** — the same line items with blank quantities/prices plus one "price per square" field; entering it fills the sheet.

Then "Generate" builds the report.

## 5. Report and Present

- The damage report follows your Claude prompt structure: cover, property/claim block, roof system + takeoff table, scope of loss by area, information still needed, disclosure and license block, branded to the company.
- "Present" opens the branded RRCA/GCN deck you pasted, populated with this job's photos, measurements and scope.

## Order of work

1. Inspection unblock (ship and you retest on the phone)
2. Measure screen revert + corner editing and line labels
3. Multi-photo sections
4. Takeoff → estimate modes
5. Report + Present

## Technical notes

- `CbCamera.done()` early-returns on a missing `workspaceId`; the workspace comes from a separate query that can resolve after the camera opens. Pass it down from the route's job query and gate the shutter, not the save.
- `cb.job.$id.measure.tsx` currently renders `SolarRoofTab` (the GC widget). Revert to the Claim Buddy pin + `cbInstantMeasureFn` call, then hand the result to `CbRoofPlanEditor` for corner editing and line labeling (the editor already has vertex/midpoint handles; re-enable the label palette with sticky mode).
- Estimate modes build on `src/lib/cbEstimate.ts`; price-per-square mode multiplies squares from `roof_measurements`.
- Present deck source is the HTML you pasted; it becomes a Claim Buddy route reading job data.
