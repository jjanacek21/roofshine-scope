# Make the damage report readable on a phone

Two fixes on the Claim Buddy report screen and the PDF it produces. No GlobalContractor screens are touched.

## 1. The action bar stops covering the report

- On phone widths (under 640px) the floating bar collapses to one compact row: the report title + version chip on the left, a primary "PDF" button, and a "More" button.
- "More" opens a bottom sheet with the rest of the actions — Email homeowner, Email adjuster, Estimate, Present, Copy link — as full-width, thumb-sized rows.
- Tablet and desktop keep the current full button row exactly as it is today.
- The report body gets top scroll padding equal to the bar's height, so a section header can never come to rest underneath it. This fixes "Provided NFA", "Facets" and "Optional exterior narrative" being clipped.
- The bottom convert dock keeps its existing spacer, so nothing is trapped under it either.

## 2. Every photo appears once at full size

- Photos stay inline where they carry meaning: cover, roof findings by elevation, exterior, interior. Unchanged.
- Section 09 "Photo appendix" becomes a compact contact sheet: small square thumbnails in a dense grid (roughly 5 per row on a phone, 8 on desktop), grouped by category and elevation as today, each with a short index label instead of a full caption. No full-size repeats.
- Same change in the PDF: the appendix renders as a thumbnail contact sheet grid rather than large photo blocks, so the file is dramatically shorter while every photo is still catalogued for the adjuster.

## Technical notes

- `src/routes/cb.job.$id.report.tsx` — split the `CbStickyHeader` contents into a mobile branch (compact row + `CbSheet` for overflow actions) and the existing desktop branch, driven by `useIsMobile()`. Add `scroll-padding-top` / `scroll-margin-top` on the report container.
- `src/components/cb/CbReportDoc.tsx` — add a `size="thumb"` variant to the internal `Photo` component (square aspect, ~64–84px, caption suppressed) and use it in the section 09 appendix grid only.
- `src/lib/cbPdf.ts` — replace the appendix photo loop's large block layout with a small grid (multiple thumbnails per row), keeping the existing "never straddle a page break" rule per row.
