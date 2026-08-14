# Claim Buddy: fix double measurements, merge takeoff into the walk, add a completion review

## 1. Measurement screen — stop showing the same number twice

Today the screen lists Eave, Rake, Drip edge and Starter as four independent editable fields, and squares are shown without waste. Fix:

- Perimeter is a single derived value: `perimeter = eave LF + rake LF`.
- Drip edge and Starter are no longer separate inputs. They are shown as read-only derived rows ("Drip edge / starter — perimeter: 93.6 LF") and saved to `drip_edge_lf` / `starter_lf` from that formula so estimates and reports keep working. An "Override" tap is available if a rep needs a different number.
- When the engine returns rake but no eave (as in the screenshot), the engine's own perimeter is split back into eave and rake instead of leaving Eave at 0, so the derived value is never wrong.
- Squares block becomes explicit:
  - Roof area (true): sq ft, no waste
  - Waste %: editable (default 10)
  - Total squares: `area x (1 + waste) / 100` — recalculated live, read-only
- Same derivation applied in the report/estimate math so nothing double-counts perimeter items.

## 2. Merge the takeoff sheet into the inspection walk

"Start inspecting" currently opens photos only, and the takeoff sheet is a separate screen you open afterwards — so stories, pitch and layers get entered twice.

New roof flow after tapping Start inspecting:

```text
Step 1  Roof system      stories, pitch, layers, roof type, decking, access/safety
Step 2  Slopes & damage   wide shot per slope, test squares, damage checklist
Step 3  Roof takeoff      flashing, ventilation, penetrations, skylights, solar,
                          gutters, hardware — each line takes a quantity OR a photo
Step 4  Complete roof inspection
```

- Step 1 replaces both the old safety card and the takeoff sheet's "Roof system" section — one entry point, one saved value (`cb_takeoffs.data.safety` and `sheet.roof_system` stay in sync, pre-filled from the measurement).
- Step 3 is the existing takeoff sheet content rendered inline as walk steps, with a camera button next to every quantity.
- The standalone "Open the roof takeoff sheet" button on the scope screen is removed (the route stays reachable for editing later).
- Exterior gets the same treatment: elevation intake, then photos, then the exterior takeoff lines, then Complete.

## 3. Completion & review before the report

Finishing a scope opens an inspection summary (works even if only the roof was inspected):

- What was inspected, per scope, with photo counts
- Roof measurements recap (area, waste, total squares, perimeter, ridge/hip/valley)
- Damage findings summary and test-square hit tally
- The line items this roof generates, from the takeoff quantities
- Pricing choice: **use the price book** (existing matcher) or **enter a price per square** — plus a manual override on any line
- Remaining gaps listed with tap-to-fix links
- Dock button: **Create report** — runs the existing report generator

This replaces the current pre-flight review page content; the existing gap logic and report generation are reused.

## Technical notes

- `src/lib/cbMeasure.ts`: add `derivePerimeter()` and `computeTotalSquares()`; `CB_LINEAR_FIELDS` splits into editable vs derived.
- `src/lib/cb-measure.server.ts`: normalize eave/rake when the engine returns only one of them.
- `src/routes/cb.job.$id.measure.tsx`: derived rows + live squares math.
- `src/routes/cb.job.$id.roof.tsx`: new 4-step wizard, absorbing sections from `cb.job.$id.takeoff.tsx`; shared section components extracted so both routes render the same fields.
- `src/routes/cb.job.$id.exterior.tsx`: same structure.
- `src/routes/cb.job.$id.scope.tsx`: drop the duplicate takeoff button, route Complete into the review.
- `src/routes/cb.job.$id.review.tsx`: recap sections, line-item table, pricing mode toggle (`price_book` | `per_square`) persisted on the takeoff row, Create report CTA.
- Pricing reuses `src/lib/cbEstimate.ts`; per-square mode multiplies total squares by the entered rate for roofing lines.
- No schema change required — pricing mode and derived flags live in `cb_takeoffs.data`.
