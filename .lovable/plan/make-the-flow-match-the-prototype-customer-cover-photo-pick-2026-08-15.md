# Make the flow match the prototype: customer → cover photo → pick an inspection

## What's wrong today

- After the cover photo the app jumps straight into the measurement screen, then into the roof wizard. The "Choose inspection" screen exists but you never really land on it.
- The roof walk ends with a button that dumps you on the pre-flight review — there is no "Finish roof inspection" that returns you to the picker.
- Exterior and interior are reachable only if you go hunting for them.
- A live runtime error (`ReferenceError: Can't find variable: y`) is being thrown in the preview, which is why last turn's changes looked like nothing happened. Fixing that comes first.

## The flow I'll build

```text
Customer + claim info
      ↓
Cover photo (front of house)
      ↓
Inspection type  ← the hub, matches IMG_4201
   ├── Exterior  → 4 elevations → Finish exterior ✓ → back to hub
   ├── Roof      → slopes, test squares, measurement, takeoff → Finish roof ✓ → back to hub
   └── Interior  → rooms → Finish interior ✓ → back to hub
      ↓
Review takeoff → Create report
```

### 1. Inspection type screen (the hub)

Rebuild `/cb/job/:id/scope` to look like the prototype:
- Header "Inspection type · Step 3 of 4" with the 4-segment progress bar.
- Completion ring on the left of "Pick your first pass".
- Three big cards — Exterior, Roof, Interior — each with icon, one-line description, and a **DONE** pill once that pass has photos or takeoff data.
- Photo-count note: "Photo count so far: N. Nothing is lost if you close the app."
- One primary bottom button: **Review takeoff**.
- Tapping a card opens that walk directly (no separate "start inspecting" step, no checkbox toggling).

### 2. Cover photo goes to the hub

`/cb/job/:id/cover` continues to the inspection-type screen instead of the measurement screen.

### 3. Measurement moves inside the Roof pass

The Roof card owns measurement ("every slope wide, test squares, hardware takeoff, instant measurement"). The roof walk gets a measurement step that opens the existing measure screen; the measure screen returns to the roof walk rather than to the takeoff sheet. The route stays where it is so nothing breaks.

### 4. "Finish" buttons on all three walks

- Roof: ends with **Finish roof ✓** → back to the hub.
- Exterior: **Finish exterior ✓** after the last elevation → back to the hub.
- Interior: **Finish interior ✓** → back to the hub.
- Review is only reachable from the hub's bottom button.

### 5. Prototype styling pass on the three walks

Match the uploaded screens, using existing Claim Buddy tokens and colors only:
- Exterior: FRONT / RIGHT / REAR / LEFT chips at the top, wide-shot dropzone, green "No damage" / red "Damage found" pair, then the damage checklist with inline qty boxes.
- Roof: test-square dropzones, squares-run / hits-per-sq / hail-size number row, soft-metals checklist grid, "Photo N saved to job file" confirmation bar.
- Interior: rooms-affected grid, "what you're seeing" grid, wide/tight photo pair, moisture reading.

## Technical notes

- Fix the `y` ReferenceError first (likely a minified/stale identifier from the last takeoff edit); verify the preview renders before anything else.
- `cb.job.$id.scope.tsx`: replace the checkbox/toggle model with direct-open cards; derive DONE from `cb_photos` counts plus takeoff sheet sections, and derive the ring % from `scoreSheet` in `src/lib/cbSheet.ts`.
- Keep writing `cb_jobs.scopes` when a pass is opened so the review recap still knows what was inspected.
- `cb.job.$id.cover.tsx`, `cb.job.$id.measure.tsx`, `cb.job.$id.roof.tsx`, `cb.job.$id.exterior.tsx`, `cb.job.$id.interior.tsx`: retarget the navigation as above.
- No schema changes; all takeoff data continues to live in `cb_takeoffs.data`.
