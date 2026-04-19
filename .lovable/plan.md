
The user wants to overhaul the "Google Solar" tab on the measurement page. Let me think through this:

1. **Rename** "Google Solar" → "AI Measurements"
2. **Interactive pin-drop flow** on satellite imagery:
   - User clicks pins on pitched roof sections
   - User drops a pin on flat roof (if attached)
   - User drops pins on additional structures (detached garage, shed, etc.)
3. **Pitch + waste factor** must apply to final totals — currently `SolarRoofTab` shows raw `plan_area_sqft` from Google Solar API without pitch multiplier or waste %.

Let me check the current SolarRoofTab and how Google Solar API returns data — it already returns per-segment pitch_degrees, so we just aren't applying the multiplier on display. And waste % needs to be a user input.

The flow I'll design:
1. Show Mapbox satellite map centered on property
2. User clicks "Detect Structures" → calls Solar API → overlays detected building footprints as pins (one pin per detected segment, color-coded)
3. User taps each pin to classify: **Pitched (main roof)**, **Flat roof**, **Additional structure (pitched)**, **Additional structure (flat)**, or **Ignore**
4. User can also manually add pins anywhere by clicking the map (for structures Solar API missed)
5. Each pitched pin uses Solar's detected pitch (or user override), each flat pin uses 1.0 multiplier
6. Global waste % slider (default 15%)
7. Totals panel shows: Plan area, Sloped area (× pitch multiplier), With waste, Squares
8. "Apply to Mapbox tab" still works — converts pins back into sections

This is a substantial UX rewrite of `SolarRoofTab.tsx`. The API route already returns segments with bounding boxes and pitch — I'll reuse it.

Files:
- `src/components/roof/SolarRoofTab.tsx` — full rewrite into interactive map with pin classification
- `src/components/roof/RoofMeasurementPanel.tsx` — rename tab label "Google Solar" → "AI Measurements"
- Reuse: `src/routes/api.solar-roof-extract.ts` (no change), `src/lib/roof-math.ts` `pitchMultiplier`, `withWaste`

I should keep the plan tight.

---

## Plan: Rename to "AI Measurements" + interactive pin-drop with pitch & waste

### 1. Rename tab
**`src/components/roof/RoofMeasurementPanel.tsx`** — change the tab trigger label "Google Solar" → "AI Measurements" (and the tab value if needed for clarity, but keep value stable to avoid breaking state).

### 2. Rewrite `SolarRoofTab.tsx` as an interactive pin-drop workflow

**New layout:** full-width Mapbox satellite map (~500px tall) on top, controls panel below.

**Flow:**
1. Map loads centered on the property at zoom 19, satellite-streets style.
2. **"Detect Structures" button** — calls existing `/api/solar-roof-extract`. For each returned segment, drops a numbered pin at the segment center, pre-classified as **Pitched** with the Solar API's detected pitch.
3. **Manual pin add** — clicking anywhere on the map drops a new pin (default: Pitched, 6/12). Useful when Solar API misses a structure (sheds, additions).
4. **Each pin is clickable** → opens a small popup with:
   - Label (e.g. "Main roof", "Garage", "Shed")
   - Type: **Pitched roof** / **Flat roof** / **Ignore** (radio)
   - Pitch dropdown (only shown for Pitched): 0/12 → 12/12, defaults to Solar's detected value
   - Plan area (sqft) — auto-filled from Solar segment if available, editable; for manual pins user enters it
   - Delete button
5. **Color coding on map:** blue = pitched, cyan = flat, gray = ignored.

### 3. Apply pitch multiplier and waste factor

Below the map, **Totals panel** with:
- **Waste %** slider (0–25, default 15) — global
- Live computed:
  - Plan area (sum of all non-ignored pins)
  - Sloped area = Σ(plan × `pitchMultiplier(pitch)`) — flat pins use 1.0
  - With waste = sloped × (1 + waste/100)
  - Squares = withWaste / 100

Uses existing `pitchMultiplier` and `withWaste` helpers from `src/lib/roof-math.ts`.

### 4. "Apply to Mapbox tab" still works

Convert each non-ignored pin into a `MapboxRoofData` section. For pins with a Solar bounding-box ring → use that polygon. For manually-added pins (no ring) → generate a small square ring (~20ft) around the pin coords as a placeholder the user can later reshape on the Mapbox tab. Pitch + waste flow into the existing per-section pitch field.

### Visual

```text
┌──────────────────────────────────────────────┐
│  [Satellite map, 500px tall, click to add]   │
│   ① main roof (pitched 6/12)                 │
│   ② garage  (pitched 4/12)                   │
│   ③ flat addition (flat)                     │
└──────────────────────────────────────────────┘
[Detect Structures]   [Clear All]
─────────────────────────────────────────────────
Pin list (editable rows: name, type, pitch, sqft)
─────────────────────────────────────────────────
Waste %: ──●────── 15%
Plan: 2,400 sqft │ Sloped: 2,683 │ +Waste: 3,085 │ 30.85 sq
[Apply to Mapbox tab]
```

### Out of scope
- Auto-detecting which structure is which (main vs garage) — user labels them.
- Drawing custom polygons on this tab — that's what the Mapbox tab is for; "Apply to Mapbox tab" hands off for refinement.
- Per-pin waste % — keeping global waste for simplicity.
