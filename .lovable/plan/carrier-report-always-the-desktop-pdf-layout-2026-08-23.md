# Carrier report: always the desktop PDF layout

The carrier report currently reflows to whatever width the phone gives it, so on a phone both the on-screen view and the downloaded PDF come out re-laid-out instead of matching the letter-size document. It should always be the same 8.5" x 11" document, on every device.

## What changes

1. **Fixed page width.** The report page stops shrinking to the screen. Every page renders at true letter width regardless of device, so columns, letterhead and totals sit exactly where they do on a computer.

2. **Phone/iPad viewing.** Because the page is now wider than a phone, the report is scaled down to fit the screen width inside the viewer (pinch/scroll still available). It looks like a shrunken sheet of paper — same layout as the desktop PDF, just smaller — instead of a rearranged mobile layout.

3. **PDF export always full size.** The PDF is captured from the unscaled, full-width document, so a download from a phone produces the identical file a computer produces: cover page, line item pages, recap, summary.

4. Applies everywhere the carrier document is used: the Present screen's "Scope line items" overlay, its Save PDF action, and the estimate tab's download in full line-item mode.

## Technical notes

- `src/components/estimate/XactimateReport.tsx`: remove `maxWidth: "100%"` from `pageStyle` and pin the page to `816px` (8.5in) with `flex: none`; keep print styles as-is.
- Add a `.xr-fit` wrapper style in `src/styles.css`: measures container width and applies `transform: scale(w/816)` with `transform-origin: top left` and a compensating wrapper height, used only for on-screen viewing.
- `src/components/cb/CbDocOverlay.tsx` / `src/routes/cb.job.$id.present.tsx`: render the carrier report inside the fit wrapper for display; the ref passed to `generateEstimatePdf` points at the inner unscaled node (html2canvas already ignores the parent transform when scoped to the inner element, so the capture stays 816px wide).
- `src/routes/cb.job.$id.estimate.tsx`: offscreen capture container width goes from `900` to `816` to match exactly.
- No changes to report content, math, branding, or any GlobalContractor screen.
