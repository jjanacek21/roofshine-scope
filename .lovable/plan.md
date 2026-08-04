# Company logos, admin assets, light panels, and sticky edge labeling

## 1. Company settings: upload a logo instead of pasting a URL

In Settings → Company, the logo field is currently a plain "Logo URL" text box. Replace it with a real uploader:

- Drag/click "Upload logo" control that sends the file to the private `company-assets` storage bucket under the company's own folder, saves the returned URL to the company record, and shows a live preview.
- Keep a small "or paste a URL" fallback collapsed under the uploader so existing links still work.
- Add a "Remove logo" action.

This matches what the admin company page already does, so both screens behave the same.

## 2. Admin panel: full asset management per company

The admin company page (Admin → Companies → Manage) already has Business Info, Features, Pricing, Contracts, Documents and Team tabs. Improvements:

- Business Info: make the logo block the primary control (upload first, URL secondary), with preview, replace and remove.
- Documents tab: allow uploading any file type per company (W-9, COI, license, warranty, brochure, contract templates), with a document label/category, upload date, download link and delete. Files go to `company-assets` scoped to that company.
- Add a compact "Brand assets" section for logo variants used on reports (primary logo, optional light-background logo) so generated reports pick the right one.

No change to how reports read branding — they keep reading the company record, so every company's reports, estimates, invoices and contracts stay per-company dynamic.

## 3. Fix black-on-black panels

Sweep every floating map/overlay panel and popup for dark backgrounds left over from the old dark theme — starting with the Storm Intelligence control panel shown in the screenshot, plus the point-report panel, saved-properties panel, roof draw toolbar, measurement panels and door-to-door overlays.

First step is reproducing the dark panel in the preview to confirm where the dark background comes from (the markup already references the light theme tokens, so something else is overriding it). Then fix the source rather than patching one panel, and verify each overlay renders white background / black text / green accents.

## 4. Sticky edge labeling (tag once, click many)

Goal: draw all lines first, click Label, click "Eave" once, then click every eave in a row; switch to Rake and repeat — no dialog between clicks.

The Label tool already has a sticky paint mode for segments of polygons and multi-point lines. What still interrupts the flow:

- Clicking a whole single line while a label type is active opens the label dialog instead of applying the active type directly. Change it to apply the active label immediately (dialog only when no type is selected).
- Same for penetration points: with an active penetration type selected, clicking applies it directly.
- Make the label toolbar clearly show which type is "armed" (highlighted chip + count of segments labeled since arming) and keep it armed until the user picks another type, picks the eraser, or leaves Label mode.
- Add keyboard shortcuts for the common types (E = eave, R = rake, V = valley, H = hip, I = ridge) so a full roof can be tagged quickly.

## Technical notes

- Uploads use the existing private `company-assets` bucket and `company_documents` table; no schema change expected unless the Documents tab needs a category/label column, in which case a small migration adds it.
- Settings company tab lives in `src/routes/_app.settings.tsx`; admin company page in `src/routes/admin.companies.$id.tsx`.
- Label behavior lives in `src/components/roof/MapboxRoofDraw.tsx` (click handlers) and `src/components/roof/DrawToolbar.tsx` (armed-type UI).
- Panel colors are semantic tokens in `src/styles.css`; fixes stay token-based, no hardcoded colors.
