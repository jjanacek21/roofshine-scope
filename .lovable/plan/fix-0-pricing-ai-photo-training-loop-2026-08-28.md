# Fix $0 pricing + AI photo training loop

## 1. Why every line is $0.00

Confirmed by querying the catalog: the roof-system template lines the AI builder inserts
(`RFG-TILE-RIDGE`, `RFG-DRIPEDGE`, `RFG-TILE-BATTEN`, `FL-PERMIT`, `FL-RENAIL`, `FL-FELT-30-DBL`,
`FL-PERIM-BUTYL`, `RFG-PIPEBOOT`, `RFG-TILE-START`…) are **made-up internal codes that do not exist
in your price book**. Your real catalog uses Xactimate codes (`0299`, `0364`, `RFGTILE`, `RFGVENTB`,
`RFGPFLASH`, …) — 22,081 items with 32,034 prices loaded.

When the builder can't find the code, it falls back to $0 and inserts the line anyway. That is
exactly what your screenshot shows: the two lines that *did* price ($997.96, $19.84) are the AI
photo lines that came back with real Xactimate codes (`0299`, `0364`); every template line is $0.

Fix: give each template slot a real catalog code.

- New table `roof_template_code_map`: template slot (e.g. `RFG-DRIPEDGE`) → real
  `line_item_master` code, optionally scoped per company, plus a note.
- Seed it with the correct Xactimate equivalents for every slot in
  `src/lib/roof-system-templates.ts` (drip edge → `RFGDRIP`-family, felt → `RFGFLT15`,
  pipe boot → `RFGPFLASH`, tile ridge → `RFGTILE` ridge line, permit → the permit code, etc.),
  verifying each against the real catalog before seeding.
- `api.build-roof-estimate` resolves: mapping → exact code → name/unit fuzzy match → $0.
  Price still comes from the job's price book (`line_item_prices`), falling back to
  `default_price`.
- Any line that still can't be priced is returned with `unmatched: true` and shown in the
  AI panel with a "no catalog match" badge, so it's visible instead of silently $0.
- Admin screen (under Admin → Price books) to review and edit those mappings per company.

## 2. Reference photo library (hardware & accessories)

New admin section **Admin → Training → Reference library**:

- Upload photos, each labeled with: name, category (roof hardware, roof accessory, exterior
  hardware, exterior accessory, damage type), trade, the catalog line item it maps to,
  default unit, and notes ("this is a lead pipe jack, not a rubber boot").
- Stored in a private `ai-reference-photos` bucket + `ai_reference_photos` table
  (super-admin write, authenticated read of active rows).
- The photo analyzer includes the labeled library as visual/textual reference in its prompt so
  it names hardware the way you do and picks the mapped code.

## 3. See what the AI picked up, why — and correct it so it learns

Job side (Photos tab / AI suggestions panel):
- Each suggested line shows the source photo thumbnails, the AI's description and reasoning,
  its confidence, and which catalog code it resolved to and how (photo, template, mapping,
  no match).
- Inline **Correct** control on each suggestion: change code / qty / unit, or mark
  "not present". Every pick, edit and reject is written to `photo_suggestion_decisions`
  (table already exists) with the reason.

Admin side (Training → Photos tab, extending what's there now):
- Full review queue of every analyzed job: suggestion vs. what the rep actually used, with
  thumbnails, filterable by low confidence / corrected / unreviewed.
- Admin can correct a decision itself and promote it to a training rule.

The learning loop:
- New table `photo_learning_rules`, built from corrections: when the AI describes X
  (asset type + phrase + trade) it should suggest code Y with unit Z. Auto-proposed once the
  same correction repeats, promoted by an admin (or auto-promoted after N identical
  corrections).
- Before each analysis, the analyzer loads the company's active rules + reference library
  labels and injects them into the prompt, so repeated mistakes stop happening.
- Admin can see per-rule hit counts to confirm accuracy is improving.

## Technical notes

- Migrations: `roof_template_code_map`, `ai_reference_photos`, `photo_learning_rules`
  (+ GRANTs and RLS: company-scoped read, super-admin/company-admin write).
- Storage: new private bucket `ai-reference-photos`.
- Server: extend `src/routes/api.analyze-job-photos.ts` (prompt context + rules) and
  `src/routes/api.build-roof-estimate.ts` (code resolution + unmatched flag).
- UI: `src/components/estimate/AISuggestionsPanel.tsx` (reasoning + correct control),
  `src/routes/admin.training.tsx` (reference library tab, richer photo review),
  new mapping editor under admin price books.
- No changes to measurement logic, theming, or existing routes.

## Sequencing

1. Pricing fix (mapping table + resolver + admin editor) — restores real dollars immediately.
2. Reference photo library + analyzer prompt wiring.
3. Correction UI + learning rules + feedback into the analyzer.
