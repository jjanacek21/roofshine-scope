
# Color-Coded Xactimate → Assembly Templates

## What you're getting

A two-part system:

1. **Color-coded PDF intake.** You highlight line items in your Xactimate PDF in different colors. You upload the PDF, label each color (e.g. "Yellow = Tile Roof Base," "Green = Chimney," "Blue = Skylight"), and we create one **assembly** per color containing exactly those line items.
2. **Smart AI suggestions on the job.** When you analyze a job's photos, the AI no longer guesses 38 duplicate line items. Instead it identifies the **roof type** plus **visible features** (chimney, skylight, valley, ventilation, two-story, etc.) and pulls in the matching assemblies as a clean checklist with quantities left blank for you to fill in.

## How assemblies work (your authoring rules)

Each assembly is just a list of catalog codes. Quantity behavior per item:

- **Manual (blank)** — default for measurements (squares, drip edge LF, valley LF, flashing LF). Item appears on the estimate with qty = 0 so you fill it in.
- **Count (AI fills)** — for hardware the AI can reliably count: skylights, chimneys, pipe boots, roof jacks. AI returns "2 skylights detected" → qty = 2.
- **Fixed** — always the same number (e.g. "1 dump fee," "1 permit").

You set the qty mode per item in the assembly editor.

You'll have two kinds of assemblies:
- **Base** — one per roof type (Shingle, Tile, Metal, Flat). Always added when that roof type is detected.
- **Add-on** — Chimney, Skylight, Valley, Ridge Vent, Wall/Step Flashing, Two-Story, Steep, etc. Added only when the AI sees them.

## Color-coded PDF intake — the workflow

```text
You ───► Upload highlighted PDF ───► /admin/assemblies/import
                                           │
                                           ▼
                            Server detects highlight colors,
                            extracts text under each highlight,
                            matches text → catalog codes
                                           │
                                           ▼
                            Review screen: each color group on left,
                            matched line items on right
                                           │
                            For each color you set:
                              • Name ("Tile Roof Base")
                              • Asset type (tile_roof | comp_roof | …)
                              • Base or add-on
                              • Per-item: qty mode, optional/required
                                           │
                                           ▼
                            Click Save → one assembly per color created
```

### What the import actually does

- Renders each PDF page, finds highlight annotations and pixel regions of saturated color (yellow / green / blue / pink / orange).
- Pulls the text under each highlighted region (covers both real PDF highlights and printed-then-scanned highlights via OCR fallback).
- Fuzzy-matches each highlighted text snippet against your `line_item_master` codes + names — shows you confidence and lets you correct misses inline.
- Groups results by color → one assembly draft per color.

## The AI side (replacing the 38-duplicate output)

`/api/analyze-property` is rewritten to return:

```json
{
  "roof_type": "comp_shingle",            // or tile / metal / flat
  "features": [
    { "type": "chimney",        "count": 1, "confidence": "high" },
    { "type": "skylight",       "count": 2, "confidence": "high" },
    { "type": "valley",         "confidence": "medium" },
    { "type": "wall_flashing",  "confidence": "high" },
    { "type": "two_story",      "confidence": "high" },
    { "type": "ridge_vent",     "confidence": "low" }
  ],
  "property_summary": { ... }
}
```

The server then:
1. Pulls the **base assembly** for the detected roof type.
2. Pulls each **add-on assembly** for every detected feature.
3. Merges them into one deduped list (same code across two assemblies = one row).
4. Pre-fills counts for items with `qty_mode = count` from the AI's count.
5. Leaves measurement items blank.

You see one tidy list grouped by assembly, hit "Add to estimate," and start filling in measurements.

## Plan steps

1. **Schema migration** — extend `master_macros` with `kind`, `asset_type`, `is_addon`; extend `master_macro_items` with `qty_mode`, `is_optional`, `item_notes`; add `assembly_imports` table to track uploaded PDFs.
2. **PDF intake endpoint** — `/api/import-assembly-pdf` parses highlights, OCRs if needed, fuzzy-matches catalog codes, returns color-grouped draft.
3. **Admin import UI** — `/admin/assemblies/import` for upload + per-color review screen.
4. **Admin assembly editor** — upgrade `/admin/macros` to handle base/add-on, asset type, per-item qty mode and optional flag.
5. **Rewrite property analyzer** — replace per-photo `consolidated_line_items` with `roof_type` + `features` detection.
6. **Expand assemblies server-side** — merge base + add-ons, dedupe, apply counts.
7. **PropertyAnalysisPanel UI** — group items by assembly, "Enter on estimate" pill for blank-qty rows, checkboxes for optional rows.
8. **Retire old per-photo `AISuggestionsPanel`** — replace with a small CTA pointing to property analysis.

## Technical details

**Schema:**
```sql
alter table master_macros
  add column kind        text    not null default 'assembly',
  add column asset_type  text,        -- comp_shingle | tile_roof | metal_roof | flat_roof
                                      -- chimney | skylight | valley | ridge_vent
                                      -- wall_flashing | step_flashing | pipe_boot
                                      -- two_story | steep_pitch | gutters | etc.
  add column is_addon    boolean not null default false;

alter table master_macro_items
  add column qty_mode    text    not null default 'manual',  -- manual | count | fixed
  add column is_optional boolean not null default false,
  add column item_notes  text;

create table assembly_imports (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid,
  uploaded_by  uuid,
  source_url   text,
  status       text not null default 'parsed',
  parsed       jsonb not null default '{}'::jsonb,  -- { colors: [{ hex, items: [...] }] }
  created_at   timestamptz not null default now()
);
alter table assembly_imports enable row level security;
-- super admins manage; company admins read+write own
```

**PDF parsing approach:** Use `pdfjs-dist` (already Worker-compatible) to extract page text + annotation rectangles. For scanned highlights, convert page to canvas via `pdf-lib` + analyze pixels for saturated color clusters, OCR the bounded region with the Lovable AI Gateway vision endpoint (which we already use). All runs in the edge function — no native binaries.

**Fuzzy matching:** lowercase + tokenize each highlighted snippet, score against `code` + `name` in `line_item_master` using a simple Jaccard score. Anything ≥ 0.6 is auto-matched; below that goes to a "needs review" list with a search box.

**Files touched / created:**
- `supabase/migrations/<ts>_assembly_templates.sql` (new)
- `src/routes/api.import-assembly-pdf.ts` (new) — color extraction + matching
- `src/routes/admin.assemblies.import.tsx` (new) — upload + review screen
- `src/routes/admin.macros.tsx` (edit) — add asset_type / addon / qty_mode controls
- `src/routes/api.analyze-property.ts` (rewrite) — roof_type + features only
- `src/components/jobs/PropertyAnalysisPanel.tsx` (edit) — grouped rendering, manual-qty pills
- `src/components/estimate/AISuggestionsPanel.tsx` (edit) — small CTA only
- `src/integrations/supabase/types.ts` (auto-regenerated)

## Confirm before I build

1. **Asset type list** — does this cover everything you'd highlight? Roof bases: `comp_shingle`, `tile_roof`, `metal_roof`, `flat_roof`. Add-ons: `chimney`, `skylight`, `valley`, `ridge_vent`, `wall_flashing`, `step_flashing`, `pipe_boot`, `two_story`, `steep_pitch`, `gutters`, `solar`. Anything to add or rename?
2. **Color set** — should I support a fixed palette (yellow / green / blue / pink / orange / purple — 6 distinct) or auto-detect any color you use?
3. **Pricing** — when an assembly drops items onto an estimate, should unit prices come from (a) the job's resolved price book, (b) the master price book attached to the uploaded Xactimate, or (c) leave blank for you to fill? My recommendation is (a) since you already resolve a price book per job.
