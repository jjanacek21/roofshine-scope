

This is a massive build — let me first explore key existing pieces I haven't yet seen, so the plan accurately reflects what's there vs what needs building.
<lov-tool-use id="toolu_vrtx_015XNyRMSEq7ncUgGRcpPgt5" name="code--view" integration-id="code" data="{\"file_path\": \"src/routes/_app.jobs.index.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FBvbXjcuCGsCEHLhT9obye" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/jobs/JobPhotosPanel.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014RN88DnV9EGA1SUQBhoXUn" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/roof/RoofMeasurementPanel.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01H6RszpLqFs4V3qNTZJ4h5J" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/roof-math.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01W8Y4tkJPKjhsYQEjzoNEH1" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/roof/RoofSectionCard.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Gdx7K5tUypF2S56fgUZ28d" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/migrations\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Pwsw5CVXDknqySK2HgP6y6" name="code--view" integration-id="code" data="{\"file_path\": \"src/integrations/supabase/types.ts\", \"lines\": \"1-100\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013LE4WHbyPnZtAcgje13hCv" name="code--view" integration-id="code" data="{\"file_path\": \"src/routes/_app.jobs.$id.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FMyKyJZeTQqwcbcgD4R5qs" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/jobs/JobPhotosPanel.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TVChdKzUuEz9x8fbuaGK6p" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/roof/RoofMeasurementPanel.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SEDYVqCpBEzCZbYXeUGEKM" name="code--view" integration-id="code" data="{\"file_path\": \"src/lib/roof-math.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015gwJQ5bGxjBkBC1u5wPXSc" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/migrations\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01L7n9GQ8maAhCt2g5dsnjn9" name="code--view" integration-id="code" data="{\"file_path\": \"src/routes/api.analyze-job-photos.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019sZHRRgTDRSk1eyzUciwhA" name="code--view" integration-id="code" data="{\"file_path\": \"package.json\"}">
</lov-tool-use>
I have enough context. Let me check a couple more critical things quickly: the estimates schema for tier names, jobs list current state, and existing report structure.
<lov-tool-use id="toolu_vrtx_01XRrZAtefxKFEC5jAALTeHU" name="code--view" integration-id="code" data="{\"file_path\": \"src/routes/_app.jobs.index.tsx\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013xYxktxVwwATVQ93BeCKt4" name="code--exec" integration-id="code" data="{\"command\": \"ls supabase/functions/ 2>/dev/null; psql -c \\\"SELECT bucket_id, name FROM storage.buckets WHERE id IN ('roof-photos','generated-pdfs');\\\" 2>/dev/null || echo \\\"no psql\\\"\", \"user_facing_description\": \"Checking existing buckets and functions\"}">
</lov-tool-use>
I have enough. Let me present the plan.

<lov-plan>

## Build 3: Job Workspace — Plan

This is a large build. I'll lay it out as 5 sequential stages so it's manageable and you can verify each before the next.

### Adaptations from your prompt to this codebase

A few things in your prompt don't match this project's actual stack — I'll adapt them rather than break what works:

- **Mapbox token**: use the existing `useMapboxToken()` hook (server route `/api/mapbox-token`), NOT `import.meta.env.VITE_MAPBOX_TOKEN`.
- **AI**: use Lovable AI Gateway (`google/gemini-2.5-pro`, key already set) like the existing `analyze-job-photos` route. NOT Claude/Anthropic. This avoids needing a new API key and matches your other routes.
- **Tables**: schema uses `job_photos` (not `photos`/`photo_analyses`), `roof_measurements`/`roof_sections`/`roof_lines`/`roof_edges` (not a single `measurements` table), `estimates`/`estimate_line_items`. I'll work with what exists and add only what's missing.
- **Routing**: TanStack file-based routing with flat dot-notation (e.g. `_app.jobs.$id.tsx`, `_app.jobs.$id.measure.tsx`).
- **PDF**: jsPDF + html2canvas as you specified.

### What's missing in DB → small migration

- `jobs.jurisdiction` (text) — for companion_rules zip/jurisdiction matching
- `estimates.tier` (text: 'good'|'better'|'best'|'supplement'|'original'), `estimates.markup_pct`, `estimates.overhead_pct`, `estimates.profit_pct`, `estimates.tax_pct`, `estimates.notes`, `estimates.hide_pricing` (bool)
- `job_photos.tag` (text: 'roof_overview'|'front_elevation'|etc), `job_photos.taken_at` (timestamptz), `job_photos.exif_gps` (jsonb)
- `companies.default_markup_pct`, `default_overhead_pct`, `default_profit_pct`, `warranty_blurb`, `financing_blurb`, `license_numbers` (text[])
- New `generated_reports` table: id, job_id, estimate_id, company_id, pdf_path, created_by, created_at
- New storage bucket `generated-pdfs` (private) + RLS policies for company members

### Stage 1 — Job detail shell + Overview tab + nested routes

**Files:**
- `src/routes/_app.jobs.$id.tsx` — rewrite as a layout route with `<Outlet />`; renders header (thumbnail, job number, status badge, price book badge, title, address, meta row, Share + Generate PDF buttons) and tab strip linking to 5 sub-routes
- `src/routes/_app.jobs.$id.index.tsx` — Overview tab (client/property/job info cards, editable status + trade dropdowns, autosaving notes textarea, Mapbox Static API map preview, activity timeline from created_at/updated_at)
- `src/components/jobs/JobHeader.tsx` — shared header component
- `src/components/jobs/JobTabs.tsx` — tab strip (Overview / Measurements / Photos / Estimate / Report)

### Stage 2 — Measurements tab (full Mapbox draw workspace)

**Files:**
- `src/routes/_app.jobs.$id.measure.tsx` — wraps existing `MapboxRoofDraw` plus a totals panel
- `src/lib/mapbox-draw-styles.ts` — custom draw styles per your spec (edge_type colors)
- `src/components/roof/MapboxRoofDraw.tsx` — extend existing component:
  - floating glass-morph toolbar with 6 buttons (Polygon/Line/Point/Select/Undo/Clear)
  - on draw.create polygon → pitch prompt with presets
  - on draw.create line → edge type dropdown
  - on draw.create point → penetration type dropdown
  - turf.js for area/length (replace haversine math with `@turf/turf` already installed)
- `src/components/roof/MeasurementTotalsPanel.tsx` — IMAGERY / ROOF TOTALS / EDGES (color dots) / PENETRATIONS / WASTE FACTOR slider + save button
- Hydrate from existing `roof_measurements` + `roof_sections` + `roof_lines` on mount

### Stage 3 — Photos tab (upload, EXIF, AI analyze, lightbox)

**Files:**
- `src/routes/_app.jobs.$id.photos.tsx` — full photos workspace
- `src/components/jobs/PhotoUploader.tsx` — drag-drop + camera capture, client-side thumbnail (canvas resize to 400px), `exifr` GPS extraction, upload to `roof-photos` bucket
- `src/components/jobs/PhotoGrid.tsx` — grid with tag overlay, analyzed checkmark, condition score with color coding, defects list, View/Add-to-Estimate buttons
- `src/components/jobs/PhotoFilterBar.tsx` — filter by tag/trade/analyzed
- `src/components/jobs/PhotoLightbox.tsx` — full-screen modal with editable tag/notes, full analysis details, Re-analyze + Add-to-estimate buttons
- Extend existing `/api/analyze-job-photos` route to also return condition_score, defects, severity, age range (already structured similarly — just expand the tool schema)

### Stage 4 — Estimate tab (tiers, line items, companion rules, totals)

**Files:**
- `src/routes/_app.jobs.$id.estimate.tsx` — main estimate workspace
- `src/components/estimate/TierTabs.tsx` — Good/Better/Best/Supplement chrome buttons + Duplicate
- `src/components/estimate/CompanionRulesBanner.tsx` — amber banner triggered on item add, queries `companion_rules` by category + jurisdiction
- `src/components/estimate/LineItemTable.tsx` — grouped by trade→category, inline-editable qty/price, source icon, delete with confirm
- `src/components/estimate/AddLineItemCombobox.tsx` — searches `line_item_master` joined with `line_item_prices` for the estimate's price book
- `src/components/estimate/AddCustomItemDrawer.tsx` — one-off items
- `src/components/estimate/EstimateTotalsPanel.tsx` — sticky right panel with markup/overhead/profit/tax inputs + Generate PDF + Send to Client (toast stub)
- Debounced (500ms) saves on all line-item edits; "Saved" indicator with relative timestamp

### Stage 5 — Report tab + PDF generation

**Files:**
- `src/routes/_app.jobs.$id.report.tsx` — live preview of all 9 PDF sections (Cover, Executive Summary, Damage Summary, Measurement Report, Investment, Documentation, Good/Better/Best, Terms & Signature, Footer); each wrapped in `.pdf-section` divs
- `src/components/report/ReportSections/*` — one component per section
- `src/lib/pdf-generator.ts` — html2canvas + jsPDF logic, uploads to `generated-pdfs` bucket, inserts `generated_reports` row, triggers download, shows toast
- "Hide Pricing" toggle that conditionally strips price columns from preview + PDF

### Other small updates
- **Jobs list / Dashboard**: ensure kanban cards and dashboard recent-jobs rows link to `/jobs/$id` via `<Link>` (some currently aren't clickable)
- **`src/main.tsx`** equivalent: ensure `mapbox-gl-draw.css` is imported globally (it's currently imported inside MapboxRoofDraw — fine, but verify)

### Out of scope for this build (will say so explicitly when done)
- Real Send-to-Client email (toast stub as you specified)
- Multi-page Good/Better/Best wizard (single tier table for now; tiers are separate estimate rows you can switch between)
- Client-side image compression beyond thumbnail (Lovable AI Gateway handles full-size images fine)
- Audit-log-driven activity timeline (uses created_at/updated_at as you specified)

### Build order
I'll do Stages 1–5 in order in the next turn(s). If a single turn gets too long I'll pause between stages. I'll tell you exactly what shipped and what didn't at the end.

