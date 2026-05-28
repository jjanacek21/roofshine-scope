I’ll fix the proposal/report layout so the PDF looks like a professional estimate instead of oversized screenshots.

Plan:

1. Redesign the cover section
- Make the rep/customer photo a small, controlled thumbnail instead of a full-width image.
- Put proposal title, customer, address, scope, and rep/company details into a clean two-column layout with larger readable text.
- Prevent uploaded/profile photos from taking over the first page.

2. Redesign the measurements section
- Keep the roof/map image at a controlled height.
- Replace the vertical label/value stack with a compact horizontal grid/table.
- Use clear measurement cards/rows for Squares, Area SF, Eaves, Ridges, Hips, Valleys, Rakes, and Pitch.
- Increase text size enough to be readable in the generated PDF.

3. Improve PDF section rendering
- Ensure sections are captured at the intended report width so text doesn’t shrink in the final PDF.
- Keep short sections flowing together on the same page when they fit.
- Avoid scaling a normal section down just because one image is large; fix the section layout first so PDF scaling stays readable.

4. Tighten supporting report sections
- Reduce large photo gallery images so they don’t waste pages.
- Keep tables and totals readable with consistent spacing.
- Preserve current report builder functionality, section ordering, pricing visibility, uploads, and PDF generation behavior.

Files to update:
- `src/routes/_app.jobs.$id.report.tsx`
- `src/lib/report-pdf.ts` if needed for capture/page-flow tuning