## Plan

I’ll fix the Savings Report PDF export so the downloaded copy is readable, uses a white page background, and matches the report generator layout more closely.

## What I’ll change

1. **Make the report itself PDF-friendly**
   - Change the report preview container from a dark slate background with white text to a white, print-style report surface.
   - Update report text, tables, cards, borders, and section headers to use dark text on white/light backgrounds so both the on-screen generator and exported PDF are readable.
   - Keep the layout structure the same: brand header, property table, satellite image + scope/restoration blocks, roof observations, benefits, cost comparison, ROI table, stat cards, urgency banner, and footer.

2. **Force white background during PDF capture**
   - Update the `html2canvas` PDF export options from the current dark background (`#0f172a`) to white (`#ffffff`).
   - Temporarily apply export-safe inline styles/classes while capturing so transparent areas, inherited app theme colors, or dark body background cannot bleed into the PDF.

3. **Improve PDF page sizing and clipping behavior**
   - Capture the report at a consistent width so the PDF doesn’t look like a tiny screenshot pasted onto a dark page.
   - Preserve the report’s aspect ratio and paginate cleanly across letter-size pages.
   - Keep the current file naming and lead status update behavior after export.

4. **Hide interactive controls from the PDF**
   - Ensure buttons like “Re-run” don’t appear inside the exported report copy.
   - Keep them visible in the generator UI only.

## Files to update

- `src/routes/_app.leads.savings.tsx`
  - Report styling and PDF export logic.

No database changes or new backend work are needed.