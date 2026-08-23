# Present mode: three tappable stat cards

On the final Claim Buddy presentation slide ("Next steps — this property"), the three stat cards become tappable, each opening a full-screen document view. Nothing else on the deck changes.

## 1. Squares of roof → roof diagram

- Card keeps the current number (total squares, pitch and waste already applied) and gains a line underneath: "Click for roof diagram".
- Tapping opens a **Measurement Report** panel in the same layout as the GlobalContractor measurement section: a diagram on the left and a grid of metric tiles on the right (Roof area SF, With waste (SQ), Eaves LF, Ridges LF, Hips LF, Valleys LF, Rakes LF, Pitch).
- The image is **not** a plain satellite tile. It is the satellite view with the saved roof footprint drawn on top — the highlighted outline plus the labeled hip/ridge/valley lines from the measurement screen — so it matches what the rep traced.
- If the job has no saved footprint geometry, it falls back to the plain satellite image so the panel never comes up blank.

## 2. Scope line items → carrier report

- Card keeps the count and label exactly as today, plus "Click for carrier report" underneath.
- Tapping opens the estimate rendered in the carrier (Xactimate) format already used in the jobs workflow — grouped line items with QTY / UNIT / UNIT PRICE / TAX / RCV columns, area subtotals, Line Item Totals, Recap by Category and Recap by Room, company letterhead and page footers, matching the uploaded estimate-Original(7).pdf.
- The same carrier format becomes the **download output of the Claim Buddy estimate tab**, replacing the current simple estimate PDF. One document definition drives the on-screen view, the presentation view and the PDF.

## 3. Photos documented → photo documentation

- Card keeps the count, plus "Click for photo documentation" underneath.
- Tapping opens a **Photo Documentation** sheet: white card, ruled heading, photos in a three-across grid with a caption line under each (elevation / tag, or "Untagged"), grouped in the order they were captured.
- Photos load through signed URLs so no broken-image placeholders appear.

## Behaviour

- Each panel opens full screen over the deck with a close button; closing returns to the same slide.
- Every panel has a Download PDF action.
- Works on phone (single column, stacked tiles), iPad and desktop.

## Technical notes

- `src/routes/cb.job.$id.present.tsx` — `PropertySlide` stat cards become buttons with a sublabel; add local state `panel: "measure" | "carrier" | "photos" | null` rendering a `CbSheet`/full-screen overlay.
- New `src/components/cb/CbMeasurementReport.tsx` — metric tiles + diagram. Diagram built from a Mapbox Static Images request with a GeoJSON overlay of the saved plan ring and labeled lines (read from the stored roof plan on `cb_measurements`), reusing the token hook already used by `MapPreview`.
- New `src/components/cb/CbPhotoDocSheet.tsx` — grid built from `cb_photos` via the existing signed-URL helper in `src/lib/cbPhotos.ts`.
- Carrier view: reuse `src/components/estimate/XactimateReport.tsx` with an adapter that maps `CbDraftLine[]` + percents to `ReportLineItem[]` (`src/lib/xact-report.ts`). Present mode and `cb.job.$id.estimate.tsx` both render it; PDF export switches from `renderCbEstimatePdf` to the rasterizing `generateEstimatePdf` pipeline so the file matches the screen. `src/lib/cbEstimatePdf.ts` stays only if another caller still needs it.
- No schema changes; no GlobalContractor screens are modified.
