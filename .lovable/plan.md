# Rebuild the damage report on the approved template

The damage report becomes: template-exact layout, an AI-written narrative, an editable review step, then the PDF. The measurement engine, roof tracer, takeoff screens, estimate builder, marketing site and RLS policies are not touched.

## 1. The template becomes the renderer

The attached HTML is turned into a page-exact React document (`CbReportTemplate`) that renders real 8.5in x 11in pages: navy running header with the property address, gold rule, running footer (contractor / project manager / prepared-for / page number), masthead, shaded fact panel, navy-header zebra scope tables, 2-up photo grid, signature block.

The PDF is produced by capturing each rendered `.page` and placing it on a Letter page — the same technique already used elsewhere in the app — so the printed PDF and the on-screen document can never drift. The current hand-drawn PDF layout is retired.

Everything branded reads from the company record: name, short name, logo, address, phone, website, license line, primary colour (default #1B2A4A) and accent colour (default #B08D57). A company with no logo prints its name in the masthead — no broken image ever renders.

## 2. The narrative gets written, not listed

"Create report" calls a server-side generation step that sends the model:

- every takeoff line the rep selected, with quantity and unit
- roof profile: system, pitch, stories, layers, decking, squares, ridge, hip, valley, eave, rake
- the ventilation calculation including any NFA deficit
- the photo list with section tags and rep notes
- carrier, date of loss, peril, inspection date

It returns JSON: `summary` (3 paragraphs), `roof_scope`, `exterior_scope`, `photo_captions`, `missing`.

Generation rules enforced in the prompt and re-checked on the result:

- The takeoff sheet is the authority for scope — every selected item gets a row, even with no photo of it.
- Photos are a sample, not a catalog — caption only what the photo shows; say so when unclear; never invent damage that is neither photographed nor on the takeoff.
- A shingle roof always lists the full replacement set: tear off, underlayment, ice & water, starter, drip edge, valley metal, hip & ridge, pipe jacks, nails and accessories, plus steep and high adders at 2+ stories or 7:12+.
- No dollar figures anywhere unless a priced estimate is attached to the job.
- Never state or imply approval; never accuse a named insurer of bad faith.
- Anything unknown prints "To be confirmed" and is listed in the Information Still Needed box. A bare em dash is never printed — a final pass replaces any stray one.

## 3. No empty headings

Every section prints either its generated findings or "Not inspected". The roof, exterior and interior sections can no longer render as a heading with nothing under it.

## 4. Cover photo

The hero uses the photo tagged as the front-elevation wide shot. If there is none, the hero image and its caption are omitted entirely rather than falling back to the first photo in the array.

## 5. New sections

Sections 4 (Storm Event & Claim Context, with act-of-god and the territory-rates explanation), 6 (How {company} Supports the Claim) and 7 (Terms & Next Steps) are added with the template copy, company name from the token.

## 6. Editable review before the PDF

After generation, a review screen shows the summary paragraphs, every scope row and every photo caption as editable fields. Rows can be reworded, deleted or added. Approving stores the edited version on the report record; re-rendering the PDF uses the stored version and never re-runs the model. Regeneration stays an explicit action ("Regenerate as a new version").

## Technical notes

- New: `src/components/cb/CbReportTemplate.tsx` (page-exact document), `src/lib/cb-report-ai.functions.ts` + `cb-report-ai.server.ts` (server function calling the Lovable AI gateway with `LOVABLE_API_KEY`, JSON-only contract with one retry, plus a post-parse guard that strips currency and approval language).
- Changed: `src/lib/cbPdf.ts` switches to page-capture of the template; `src/lib/cbReport.ts` gains the front-elevation cover resolver and stores the AI payload; `src/routes/cb.job.$id.generating.tsx` calls the generation step; `src/routes/cb.job.$id.report.tsx` becomes the review/edit surface.
- Migration: add `short_name` and `license_line` to `cb_companies` (`primary_color`, `accent_color`, `logo_url`, `address`, `phone`, `website` already exist). No RLS policy changes.
- Report storage: the AI payload plus edits live in the existing `cb_reports.narrative` / `line_items` JSON columns under new keys, so old reports keep rendering.

## Verification

Generate a report on a job with a completed takeoff, paste the model's raw JSON, render the PDF and paste the first two pages as images, and confirm no dollar figures appear anywhere and no section heading is empty.
