# Simple mobile workflow for multiple roof footprints

## Goal

Make measurement a clear one-roof-at-a-time process:

```text
Drop pin → Measure → Adjust corners → Save this footprint
                                      ↓
                         Add another roof (optional)
                                      ↓
                Save all footprints and continue to lines
```

The main roof, flat roof, garage, and shed remain separate colored structures. Measuring a later pin must never merge with, replace, or reshape an already saved footprint.

## What is causing the confusion now

- A measurement run replaces the persisted `roof_sections`, then the page tries to append the previous sections back only in browser state. This makes incremental roofs fragile and lets reload/reset disagree with what is visible.
- Grouping is reconstructed from whichever pins are currently in memory; the saved sections do not retain a durable structure/pin identity.
- Saved correction lookup is property/proximity based and a correction row can contain multiple shapes, so another nearby pin can reuse the wrong footprint.
- “Reset” restores the initial satellite shape while “AI trace” displays a second reference overlay. Their meanings are not clear in the current toolbar.
- Claim Buddy saves the final roof plan, but it does not currently write corrected footprints into the existing AI correction/training pipeline used by the main measurement workflow.
- The confidence badge and wrapped toolbar compete for the same limited map space on phones.

## Changes

### 1. Measure and lock one structure at a time

- Introduce an explicit active-structure workflow. Only the newly dropped pin is sent for measurement.
- Return the new traced structure without replacing existing saved structures in the database.
- Let the rep drag corners and add/remove vertices only on that active structure.
- Replace the ambiguous global lock with **Save this footprint**. Saving locks that structure and persists it immediately before another pin can be added.
- After saving, show two clear actions: **Add another roof** and **Continue to roof lines**.
- Give every structure a stable ID, pin coordinate, order, name, and color so Main roof and Flat roof stay independent across save, reset, and reload.

### 2. Make reset and AI reference structure-specific

- Replace **Reset** with **Restore AI outline** for the active, unlocked structure only.
- Keep the AI outline as an optional dashed reference for that structure; never render it as another filled footprint.
- Remove the top-level **AI trace** button from the primary toolbar and place **Show AI outline** inside settings.
- Once a footprint is saved, restoring or remeasuring it requires selecting that structure and explicitly choosing **Edit footprint**.

### 3. Save corrected footprints for reuse and learning

- When **Save this footprint** is tapped, save both:
  - the corrected outline used by the job; and
  - a correction example containing the original AI outline, corrected outline, pin coordinate, structure identity, areas, company, property/job, and user.
- Reuse the existing `roof_corrections` and training pipeline, but store/match one correction per structure rather than one mixed collection for the whole property.
- Update correction lookup to select the nearest structure-specific correction to the exact pin. A main-roof correction must not be returned for a pin on the flat roof.
- Upsert repeated saves of the same structure instead of creating duplicate training rows for every tap.
- Keep the existing company calibration behavior so accumulated corrections improve future starting outlines without silently changing already saved footprints.

### 4. Mobile-first map controls

- Keep only the current task as a prominent bottom action: **Measure roof**, **Save this footprint**, or **Continue to roof lines**.
- Use a compact top row for the active structure selector, Undo, and a gear icon.
- Move confidence, restore AI outline, show/hide AI reference, clear current footprint, and other secondary actions into a full-width bottom settings sheet opened by the gear.
- Show confidence inside that sheet and as a small nonblocking status beside the active structure name—never floating over map controls.
- Preserve large touch targets, safe-area spacing, and one-handed operation; prevent wrapped controls from covering the map.

### 5. Lines after all footprints are saved

- Enter line mode only after the footprint stage is complete.
- Perimeter segments remain individually selectable for eave/rake labels.
- Interior lines remain split into tap-to-tap segments so ridge, hip, valley, transition, and flashing can be labeled independently.
- Save the complete plan and corrected footprint examples, then continue to takeoff.

## Technical details

- Extend the persisted roof-section model with durable structure metadata (structure key/order and pin latitude/longitude) through a database migration with the required grants/RLS-compatible access, and update the Claim Buddy roof-plan RPCs to round-trip it.
- Refactor the instant-measure helper so measuring one pin returns/appends one structure rather than replacing the property’s complete `roof_sections` set.
- Update `cbRoofPlan` merging to operate only on facets returned for a single pin; never union sections across structure IDs.
- Add a protected server function for correction upsert so company/property/user identity is validated server-side and correction writes are atomic with the structure save.
- Update correction lookup to rank exact structure/pin matches by distance and recency, and ignore multi-structure legacy rows when they cannot be safely assigned to the requested pin.
- Verify on a phone-sized viewport with this sequence: main roof measure/edit/save → flat roof measure/edit/save → reload → two independent overlays remain → draw and label lines → save and continue.