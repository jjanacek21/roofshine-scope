# Roof takeoff — one screen, more sections, no double entry

## What exists today

Two roof takeoff screens:

- `cb/job/$id/takeoff` — the sectioned one you want to keep. Cards per category, % pill, count/LF field + camera per row, chip selectors, "Go to review".
- `cb/job/$id/roof` — the one to delete. "1 · Elevation wide shots", "2 · Roof hardware", "3 · Close-ups", "Finish the roof".

Right now the inspection hub and the measurement screen both send you to the screen being deleted.

## The changes

### 1. One screen, enforced flow

- Move the four wide-shot slots (Front, Right, Rear, Left) into the sectioned takeoff as the first card, keeping the same photo storage they use today (`category: roof`, `shot_type: wide`, per-elevation) so existing photos still show up.
- Delete `cb/job/$id/roof` and repoint everything that linked to it: the inspection hub, the measurement screen's "done" step, and the estimate screen's "back to the roof" link.
- Flow becomes: start roof inspection → measurement → sectioned takeoff → Go to review. If a job has no saved measurement, the takeoff sends you to the measurement screen first, so it cannot be skipped.

### 2. New sections, same card format

Section order after the change:

1. Wide shots (Front / Right / Rear / Left — the only per-slope card)
2. Roof system
3. Measurements (read-only mirror + rep adjust, as today)
4. Decking
5. Underlayment
6. Flashing (chimney removed)
7. Chimney
8. Ventilation (NFA calculation unchanged)
9. Penetrations
10. Skylights
11. Flat / low-slope roof
12. Insulation (collapses when "direct to deck / none" is on)
13. Edge metal
14. Solar
15. Gutters
16. Accessories / everything else on the roof
17. Roof notes

Each new section gets the same card, % pill, count/LF fields, camera icons and chip selectors as the existing ones — no restyling.

### 3. No double entry

- Chimney fields leave Flashing and live only in the Chimney card. Values already saved under Flashing are carried over on open, so nothing is lost.
- The old "Roof hardware" section is retired into Accessories (snow guards, anchors, satellite dish, antenna, lights, cameras, heat cable), again carrying old values across.
- Decking type/condition move out of Roof system into Decking, carried over the same way.
- Items that could read as duplicates are assigned one home only: A/C line set covers stay in Penetrations, roof hatch/scuttle sits in Accessories (not in Flat roof), drip edge / valley metal / ridge cap LF live in Edge metal.

### 4. Estimate: one row, one line

- Every takeoff row that resolves to the same price-book code **and** unit is merged into a single line with the quantities summed, with the basis text listing what fed it. The same code can never be emitted twice.
- Pipe jacks are mapped by what actually exists in the price book: 1.5", 2", 3" and 4" all resolve to the single "up to 4"" item, so they merge into one line instead of three copies of code 0207. Lead boots, split boots, copper, 6" and 8" have their own distinct items and stay separate lines.
- The line item name in the estimate stops truncating — it wraps to as many lines as it needs and stays editable.

### 5. Report and estimate reach the new fields

Decking, underlayment, chimney, flat roof, insulation, edge metal and accessories all flow into the report scope sheet and are available as estimate quantities, same as the existing sections.

## Compatibility

Everything keeps writing to the same `cb_takeoffs` row (`data.sheet` / `elevations`). Old inspections open with their photos, quantities and elevation state intact; legacy values that moved sections are read from their old location and written to the new one on the next save.

## Verification I will report back

- Roof takeoff screen count after the change (must be 1).
- The section list in order plus a duplicate audit showing no item in two sections.
- An estimate built from pipe jacks at 1.5", 2" and 4" — showing the merged single line with summed quantity and no repeated code.
- An inspection created before the change opening with its photos.

## Technical notes

- `src/lib/cbSheet.ts`: new typed sections (`decking`, `underlayment`, `chimney`, `flat_roof`, `insulation`, `edge_metal`, `accessories`), option lists, legacy migration inside `readSheet`, and `scoreSheet` entries so each new card gets a real % pill.
- `src/routes/cb.job.$id.takeoff.tsx`: wide-shot card + camera wiring, new section cards, measurement gate.
- `src/routes/cb.job.$id.roof.tsx`: deleted; links updated in `cb.job.$id.scope.tsx`, `cb.job.$id.measure.tsx`, `cb.job.$id.estimate.tsx`.
- `src/lib/cbEstimate.ts`: distinct pipe-jack matchers, a merge-by-(code, unit) pass over the final draft lines, and planned lines for the new sections.
- `src/lib/cbReport.ts` / `src/lib/cbSheetRows.ts`: new sections in the report scope and row definitions.
- No logo, color, GlobalContractor, presentation deck or measurement engine changes.
