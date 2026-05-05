I’ll replace the current “one huge screenshot sliced across pages” PDF export with a report-accurate capture pipeline that preserves the on-screen layout.

Plan:

1. Update the Savings Report export logic
   - Capture the report at its actual rendered width instead of forcing `1100px`.
   - Temporarily lock the report’s current measured width/height during export so responsive breakpoints, spacing, tables, cards, and the header match what is visible on screen.
   - Keep the white report background and hide only interactive controls marked `no-print`.

2. Fix page slicing so the PDF is not distorted
   - Instead of adding the same tall image repeatedly with negative offsets, slice the canvas into page-sized canvas chunks.
   - Add each slice to a letter-size PDF with consistent white margins.
   - This avoids cropped/shifted pages and keeps each PDF page visually identical to the matching portion of the on-screen report.

3. Improve image quality and fidelity
   - Use PNG for the generated PDF image pages rather than JPEG compression artifacts.
   - Use a scale that balances sharp text with reasonable file size.
   - Explicitly wait for fonts and satellite imagery to finish loading before capture when possible.

4. Add export-only CSS safeguards
   - Keep `.is-exporting .no-print` hidden.
   - Add minimal export-specific rules only where needed to prevent shadows/background bleed or browser layout differences during capture.
   - Avoid restyling the report itself so the PDF matches the current UI rather than a separate print theme.

5. Verify with the live preview
   - Use the current `/leads/savings?leadId=17c46228-2736-4c89-a9e5-42f9400b3f15` route.
   - Generate/export the PDF and visually compare it against the on-screen report layout.
   - If a generated artifact is available in the workspace, convert pages to images and inspect for clipped text, bad margins, blank pages, broken table layout, or mismatched colors before finishing.