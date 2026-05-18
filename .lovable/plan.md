# Customizable Branded Report Builder

Upgrade `/jobs/$id/report` from a fixed-section preview into a true report **builder**: drag-to-reorder sections, add/remove/edit custom sections, generate AI templates (flyers, infographs, cover letters, cover photos), upload custom documents, and embed videos that play inside the PDF on mobile and desktop. Branding (logo, company info, rep details) auto-populates on every section.

---

## 1. Data model (Lovable Cloud)

New tables (RLS by `company_id` via `auth_company_id()`):

- **`report_templates`** — reusable per-company templates
  - `company_id`, `name`, `is_default`, `sections` (jsonb array of section blocks)
- **`job_reports`** — the working report for a job
  - `job_id`, `company_id`, `template_id` (nullable), `rep_user_id`, `sections` (jsonb), `cover_settings` (jsonb), `updated_at`
- **`report_assets`** — uploads + AI-generated assets used in sections
  - `company_id`, `job_id`, `kind` ('upload' | 'ai_image' | 'ai_doc' | 'video'), `storage_path`, `bucket`, `mime_type`, `meta` (jsonb: AI prompt, duration, poster, etc.)

New storage bucket: **`report-assets`** (private, keyed `{company_id}/{job_id}/...`), plus reuse existing `generated-pdfs`.

### Section block schema (jsonb)
```text
{ id, type, title, visible, order, props: { ... } }
```
Built-in `type` values: `cover`, `executive`, `damage`, `measurement`, `investment`, `documentation`, `photos`, `options`, `terms`, `footer`.
Custom `type` values: `rich_text`, `image`, `flyer`, `infographic`, `cover_letter`, `cover_photo`, `uploaded_doc`, `embedded_video`, `divider`.

---

## 2. Builder UI (`src/routes/_app.jobs.$id.report.tsx` refactor)

Replace the current section-checkbox bar with a left **Sections panel** + right **Live preview**.

- Section panel: list of blocks with drag-handle (dnd-kit), eye toggle, edit, delete, and an "Add section" menu.
- "Add section" menu groups: **Built-in**, **Custom content** (rich text, image, divider, uploaded doc, embedded video), **AI templates** (flyer, infograph, cover letter, cover photo).
- Inline editors per section type (rich text via simple contentEditable + markdown; image picker pulls from `report_assets`).
- Auto-save to `job_reports` on every change (debounced); keep current localStorage as fallback for offline edits.

Branding header auto-built from `companies` + assigned rep profile (already in `profiles`): logo, company name/phone/email/website, rep name/photo/phone/email. Applied to cover + footer of every page.

---

## 3. AI template generation

New server functions in `src/lib/report-ai.functions.ts` (uses Lovable AI Gateway — no extra keys):

- `generateFlyer({ jobId, style })` → Gemini 3 image preview, returns image saved to `report-assets`.
- `generateInfographic({ jobId, dataPoints })` → image with damage stats / scope summary.
- `generateCoverLetter({ jobId, tone })` → `gemini-2.5-pro` text, stored as `rich_text` block content.
- `generateCoverPhoto({ jobId, prompt })` → hero image for cover section.

Each writes a `report_assets` row and returns its id; the builder inserts a block referencing it. User can regenerate / edit prompt / replace.

---

## 4. Custom uploads

- "Upload document" → PDF/PNG/JPG into `report-assets`. PDFs get rendered as image pages in final output (pdf-lib merge — see PDF section).
- "Upload video" → MP4/MOV into `report-assets`, auto-generate poster frame; stored with a public signed URL valid 1 year for the embed.

---

## 5. Embedded videos in the PDF

Switch PDF generation from `jspdf + html2canvas` to **`pdf-lib`** (already Worker-friendly) on the client:

- Render each section to a PNG via html2canvas-pro (existing flow).
- Use `pdf-lib` to assemble pages, then for each `embedded_video` block add a **RichMedia annotation** with a poster image and a `video/mp4` stream. This plays inline in Acrobat (desktop) and most mobile PDF viewers that support rich media.
- Fallback for viewers without rich-media support: the poster image is clickable and links to a hosted signed URL of the video (works in Apple Books, Chrome PDF viewer, Gmail preview).

Final PDF still uploads to `generated-pdfs` and mirrors into `job_documents` exactly as today.

---

## 6. Template management

- New tab in **Settings → Branding**: "Report templates" — list, create, rename, set default, edit sections.
- "Save as template" button in the builder snapshots the current `sections` into `report_templates`.
- New jobs auto-load the company default template; users can switch templates from a dropdown in the builder.

---

## Technical details

**Files to create**
- `src/routes/_app.jobs.$id.report.tsx` (refactor to builder)
- `src/components/report/SectionPanel.tsx`, `SectionPreview.tsx`, `AddSectionMenu.tsx`, `BlockEditors/*`
- `src/components/report/AIBlockDialog.tsx` (prompt + style picker)
- `src/lib/report-ai.functions.ts` (server fns: flyer/infograph/cover letter/cover photo)
- `src/lib/report-pdf.ts` (replaces `src/lib/pdf-generator.ts`, pdf-lib based, with RichMedia video annotation helper)
- `src/routes/_app.settings.tsx` (add Report Templates tab) or new `src/routes/_app.settings.templates.tsx`

**Migration** (one batch)
- `report_templates`, `job_reports`, `report_assets` with RLS scoped by `auth_company_id()`
- Storage bucket `report-assets` (private) with company-folder RLS pattern matching `roof-photos`

**Dependencies**
- `pdf-lib`, `@dnd-kit/core`, `@dnd-kit/sortable`

**Out of scope (this round)**
- Sending the report by email (already covered by existing email infra; can be wired after).
- Per-section page numbering inside the PDF (current section-fit logic preserved).
- Animated/interactive infographics (we generate static images first; SVG/HTML embed can come later).
