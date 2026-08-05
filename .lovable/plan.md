# One footprint overlay and editor for every instant measurement

## Goal

Every instant-measurement workflow will show the measured roof footprint as a translucent highlighted polygon immediately after measuring. The user can enter **Edit footprint**, drag its corner handles onto the true roof edge, add or remove corners when needed, and save the corrected footprint as training data.

This scope is footprint-only. Automatic or editable ridge, hip, valley, eave, and rake lines will not be added; those remain manual tools.

## What the investigation confirmed

- The shared measurement endpoint already returns a building `footprint` and polygon `ring` data.
- Job Measure currently has its own overlay and vertex editor, but its map lifecycle is failing at runtime and can stop painting the polygons.
- Storm Intelligence receives saved section polygons and paints them, but has no shared footprint-editing controls.
- Door-to-Door's instant quote and the Roof King damage/savings measurement flows currently keep the square footage but discard the returned polygon rings, so they cannot highlight or edit the measured area.
- The runtime currently also reports `ReferenceError: y is not defined`; this must be resolved before overlay verification is considered complete.

## Implementation

### 1. Create one canonical footprint model

- Normalize every measurement response into structures containing one editable exterior footprint ring, area, source run ID, and pin/location identity.
- Treat the exterior footprint as the measurement boundary shown and edited everywhere; do not expose the internal AI facet/ridge subdivision in this workflow.
- Recalculate plan area whenever a corner moves, is inserted, or is removed so the displayed square footage follows the corrected polygon.

### 2. Build a reusable Mapbox footprint overlay/editor

- Add a shared map helper/component for source and layer creation, repainting after load/style changes, and cleanup.
- Render a clearly visible translucent fill plus solid outline above satellite imagery.
- Add an explicit **Edit footprint** mode with draggable corner handles.
- Support midpoint handles to add a corner, and selected-corner delete with a minimum of three corners.
- Include Save, Cancel, Undo, and Reset to AI footprint controls.
- Keep pins visible, but visually subordinate them once a measured footprint exists.

### 3. Use it in every instant-measurement tool

- **Job Measure:** replace the fragile per-facet paint path with the shared exterior-footprint overlay/editor and fix the runtime/map lifecycle failure.
- **Door-to-Door World:** return polygon data from Auto-Measure, show it on the property map/measurement panel, and allow editing and saving there.
- **Storm Intelligence:** connect the existing roof-section data to the shared editor instead of display-only polygons.
- **Roof King damage/savings:** retain rings returned by the measurement endpoint, show them on the satellite map in the lead/report measurement workflow, and expose the same edit/save controls.
- Update both the inline lead measurement view and the full report wizard so they persist and reload the same corrected geometry rather than saving only square footage and pin coordinates.

### 4. Save corrections to the measurement and training history

- Preserve the original AI footprint before editing.
- On Save, persist the corrected polygon as the active saved measurement so reopening any supported tool shows the corrected highlight.
- Record original versus corrected geometry, area delta, property/lead/job context, source workflow, and AI run ID in the existing training pipeline.
- Never train on a canceled edit; Reset restores the original AI outline until Save is pressed.

### 5. Verify the actual behavior

- Fix the current `y is not defined` runtime error and confirm no overlay-related console errors remain.
- Test each workflow against a measured roof: highlight appears immediately, survives map style/load events and reopening, and stays aligned while zooming/rotating.
- Test drag, add, delete, undo, reset, save, and reload on desktop and mobile-sized layouts.
- Confirm corrected area is used by downstream quantity/report calculations and that no ridge/valley generation was introduced.

## Technical notes

- Reuse `/api/solar-roof-extract` as the single measurement source; extend consumers to retain its existing geometry instead of creating separate measurement engines.
- Extract polygon normalization, area calculation, overlay lifecycle, and vertex editing from `SolarRoofTab.tsx` into focused shared modules/components.
- Keep existing company-scoped access rules and existing measurement/training tables; no new public data access is required.