
This is a massive request — let me decompose it carefully.

## What's actually being asked

1. **Pricing scope**: Global "default" admin price book + company admins can add their own insurance OR retail pricing
2. **Roof measurement system** with 5 input methods:
   - Google Solar API (auto-extract roof geometry from satellite)
   - Anthropic Claude vision for damage/condition analysis
   - Third-party report PDF upload (EagleView/Hover) → AI extract
   - Manual numeric entry form
   - **Mapbox polygon drawing tool** with multi-section support, per-section pitch, area auto-calculation, waste % options
3. **Edge labeling**: lines between polygon vertices can be tagged eaves/rakes (computed perimeter)
4. **Linear features**: draw straight lines for hips/ridges/valleys/gutters/wall-flashing/step-flashing/transitions (each accumulates LF)
5. **Photo analysis** with Claude → damage detection + condition
6. **Round 1+2 of prior plan** (PDF price-list admin + photo→line-item matching + manual search) — verify end-to-end with a test customer + estimate
7. **Verify by going through full flow**: add customer → estimate → satellite pull → AI roof measure → condition analysis → all steps

## Reality check on scope

This is realistically **4–5 build rounds**. Trying to do all of it in one go will produce broken code. Even the prior "Round 1+2" wasn't built yet. I need to stage this aggressively.

Also a few technical gotchas:
- **Google Solar API** has good coverage in US suburbs but spotty for commercial/rural. We'll need a fallback.
- **Anthropic API key** is already in secrets. Can use `claude-sonnet-4` for vision via Lovable AI gateway? No — Lovable AI gateway only serves Gemini + GPT-5. For Claude specifically we'd call Anthropic API directly with the user's `ANTHROPIC_API_KEY`. Or use Gemini 2.5 Pro vision (works fine and is gateway-served — recommended).
- **Mapbox polygon drawing** uses `@mapbox/mapbox-gl-draw`. Need to add custom modes for "labeled segments" (no out-of-the-box feature for this).
- Pitch math: actual roof area = plan area × √(1 + (rise/run)²). Stored per polygon section.

## Memory updates needed

- "Default platform price books exist (admin-uploaded). Companies can add their own insurance/retail price books on top."
- "Roof measurements support 5 input methods: Google Solar API auto, Mapbox polygon draw, third-party PDF (EagleView/Hover), manual numeric entry, AI photo analysis. Stored per-property."

## Two questions before building

I have to ask before kicking off — some of these decisions cascade through the schema and which round contains what.

## The proposed plan

### Round A (this round) — Foundation: pricing scope + roof measurements schema + manual entry + Mapbox draw

**A1. Memory updates**

**A2. Migration**
- Make `price_books.company_id` nullable + add `is_default boolean default false` + add `pricing_type text` (`insurance` | `retail` | `default`)
- RLS: default/global price books readable by all authenticated users; only super_admin can write them
- New `roof_measurements` table (one per property): squares, eaves_lf, rakes_lf, ridges_lf, hips_lf, valleys_lf, gutters_lf, wall_flashing_lf, step_flashing_lf, transition_lf, predominant_pitch, source enum, source_file_url, ai_analysis jsonb, created_at, updated_at
- New `roof_sections` table (multiple per property/measurement): name, polygon_geojson, plan_area_sqft, pitch (e.g. "6/12"), pitch_multiplier, actual_area_sqft, sort_order
- New `roof_edges` table: section_id, edge_index, edge_type enum (eave/rake/hip/ridge/valley/gutter/wall_flashing/step_flashing/transition), length_lf
- New `roof_lines` table (free-floating linear features): measurement_id, line_geojson, line_type enum, length_lf

**A3. Pricing UI updates**
- `/price-books` list: show pricing-type badges (Default/Insurance/Retail). Filter by type.
- `/price-books/new`: add pricing-type dropdown (insurance/retail). Default option only available to super_admin.
- Job's `price_book_id` resolution updated: prefer company's books matching zip+type, fallback to default global book

**A4. Roof Measurement panel** (new component, lives on Property detail or new Job step)
- Tabs: Manual / Mapbox Draw / Upload Report / Auto-from-Satellite (Google Solar) / Photo AI
- **Manual tab**: numeric inputs for every measurement, predominant pitch dropdown, waste % toggle (10/15/20%), live "Bundles needed" calc
- **Mapbox Draw tab**: 
  - Mapbox satellite map centered on property lat/lng
  - `mapbox-gl-draw` polygon mode for adding roof sections
  - Per-section card: name, pitch input → multiplier auto, plan area, actual area, color
  - Per-edge labeling UI (click edge → choose eave/rake/etc.)
  - Linear-feature mode: draw line strings, label as hip/ridge/valley/gutter/wall_flashing/step_flashing/transition
  - Live totals panel (squares, eaves LF, rakes LF, etc.)
  - Save → writes to `roof_measurements` + `roof_sections` + `roof_edges` + `roof_lines`

### Round B — AI: Google Solar auto-roof + Anthropic damage analysis + photo→line-item matching

**B1. Edge function `solar-roof-extract`**
- Input: lat/lng
- Calls Google Solar API `buildingInsights:findClosest`
- Returns roof segments with stats; we convert to polygon sections + auto-compute perimeter edges
- "Use these measurements" button populates the Mapbox tab

**B2. Edge function `analyze-roof-condition`**
- Inputs: satellite image URL (Mapbox static API at high zoom) + uploaded photos
- Calls Anthropic Claude (vision) via Anthropic API with `ANTHROPIC_API_KEY`
- Tool-call returns: `{condition: poor|fair|good|excellent, damages: [{type, severity, location_hint, evidence_photo_url}], recommended_trades: [...], notes}`
- Stored on `roof_measurements.ai_analysis` jsonb

**B3. Job photos system**
- New `job_photos` table + `job-photos` storage bucket (private, company-scoped)
- Upload UI on job detail page
- Edge function `analyze-job-photos` (Gemini 2.5 Pro vision via Lovable AI gateway): photo + price book → matched line items + companion suggestions
- "Add detected items to estimate" flow: prompts qty/size for non-roof items, auto-fills from `roof_measurements` for roof items

**B4. Manual line item search in estimate builder**
- Typeahead search across active price book → add row → qty input

### Round C — Third-party report PDF + companion suggestions sidebar + verification walkthrough

**C1. Edge function `extract-roof-report-pdf`** (EagleView/Hover) → populates roof_measurements
**C2. Edge function `suggest-companion-items`** for the sidebar
**C3. End-to-end test walkthrough** with seeded test client + property + photos

### Files (Round A only)
- `supabase/migrations/<timestamp>_*.sql`
- `src/components/roof/RoofMeasurementPanel.tsx`
- `src/components/roof/ManualMeasurementForm.tsx`
- `src/components/roof/MapboxRoofDraw.tsx`
- `src/components/roof/RoofSectionCard.tsx`
- `src/components/roof/EdgeLabelEditor.tsx`
- `src/lib/roof-math.ts` (pitch multiplier, waste calc, polygon area, edge length)
- Updates: `_app.price-books.tsx`, `_app.price-books.new.tsx`, `_app.clients.$id.tsx` (Properties tab gets "Roof" button)

### Two questions

I need answers before kicking off. The choices cascade:

1. **Vision provider for damage analysis** — Anthropic Claude vs Gemini 2.5 Pro
2. **Google Solar API key** — confirm whether to use the existing `GOOGLE_MAPS_API_KEY` (it covers Solar API if Solar is enabled in your Google Cloud project) or add a separate secret

Without these I'd have to guess and risk wiring things up wrong.
