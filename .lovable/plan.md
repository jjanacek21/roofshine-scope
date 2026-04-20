

## Goal

Let users draw **multiple distinct roof sections** on the same property in the Mapbox roof tool — each with its own pitch (or flat), its own square footage, its own waste factor — and have the totals panel + saved report **break them out separately** instead of merging them into one number.

## What changes

### 1) Treat each polygon as its own "Roof Section"
Every time the user draws a polygon, it becomes a labeled section:
- Auto-named **"Roof 1", "Roof 2", "Flat Section 1"**, etc.
- User picks a pitch (the existing pitch dialog already does this). Add a **"Flat (0/12)"** quick option at the top.
- Section gets its own color so it's visually distinct on the map.

### 2) Add an "Add Additional Roof" affordance
On the totals panel (right side), add a button: **+ Add Additional Roof**.
- Clicking it switches the draw tool back to polygon mode.
- After the polygon is closed, the pitch dialog appears with a section-name field.
- The new polygon shows up as its own row in a **Sections list** in the totals panel.

### 3) Per-section totals + per-section waste factor
The totals panel changes from a single block of numbers to:

```text
Sections
─────────────────────────────────────────
Roof 1     6/12   1,840 sqft   20.6 sq   waste 15%   [edit] [delete]
Roof 2     8/12     920 sqft   10.7 sq   waste 15%   [edit] [delete]
Flat 1     0/12     400 sqft    4.0 sq   waste 10%   [edit] [delete]
─────────────────────────────────────────
Combined: 35.3 squares · 3,160 sqft sloped
```

Each row shows: name, pitch, plan area, sloped squares, its own waste %.
Combined total at the bottom is the sum across all sections.

### 4) Save each section separately to the database
The `roof_sections` table already supports this (it has `measurement_id`, `name`, `pitch`, `plan_area_sqft`, `actual_area_sqft`, `color`). Today we lump everything into the parent `roof_measurements` row. New behavior:
- Insert one `roof_sections` row per drawn polygon, with its own pitch, color, name, plan area, sloped area.
- Keep `roof_measurements` as the parent (one per save) but stop relying on `total_area_sqft` / `squares` as the only source of truth — derive them by summing sections.

### 5) Show sections separately on the job report
The job report (PDF + on-screen) currently prints one total. Update it to print a **Sections breakdown table** (Name · Pitch · Plan SqFt · Sloped SqFt · Squares · Waste · Adjusted Squares), then a **Combined Totals** row.

Lines (eaves, ridges, hips, etc.) stay grouped at the measurement level — not per section — because they’re typically traced across the whole roof.

## Files to edit

- `src/components/roof/MapboxRoofDraw.tsx` — track each polygon as a named section with its own pitch + waste; assign rotating colors; pass section list up.
- `src/lib/measurement-utils.ts` — return a `sections: SectionTotal[]` array (per-polygon totals) in addition to the combined totals.
- `src/components/roof/MeasurementTotalsPanel.tsx` — render the sections list with edit/delete + per-section waste, plus the combined footer; add the **+ Add Additional Roof** button.
- `src/components/roof/MeasurementPromptDialog.tsx` — add a section-name field on the pitch prompt; add a "Flat (0/12)" preset.
- `src/components/roof/RoofMeasurementPanel.tsx` — when saving, insert one `roof_sections` row per drawn polygon (currently it collapses them); load sections back the same way when reopening.
- `src/components/roof/RoofSectionCard.tsx` — already exists; reuse for the per-section row UI.
- `src/lib/pdf-generator.ts` and `src/routes/_app.jobs.$id.report.tsx` — add the per-section breakdown table.

## Out of scope

- No DB schema changes. `roof_sections` already has every column needed (`name`, `pitch`, `color`, `plan_area_sqft`, `actual_area_sqft`, `pitch_multiplier`, `sort_order`).
- No changes to line-drawing (eaves/ridges/etc. stay measurement-level).
- No changes to the AI roof-condition tab.

## Result

Draw the main pitched roof → name it "Main Roof", set 6/12, get 20.6 sq with 15% waste. Click **+ Add Additional Roof**, draw the flat addition → name it "Flat Addition", set 0/12, set its own waste %. The totals panel shows both sections separately plus a combined total. The saved measurement and the job report both break the two roofs out as distinct rows.

