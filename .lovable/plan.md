## Problems

1. **PDF export silently fails.** `html2pdf.js` uses `html2canvas`, which can't parse the `oklch()` color values that Tailwind v4 emits (`bg-slate-900`, `text-slate-400`, etc.). The promise rejects with an `[object Response]`-style error, the toast never fires, and no file downloads.
2. **"Run AI Analysis" still routes to the old wizard.** In `src/routes/_app.leads.savings.tsx` (line ~341), the fallback button under "Roof Observations" navigates to `/leads/wizard` instead of running the satellite-image AI vision analysis directly.

## Fix

### 1. PDF export — swap to `html2canvas-pro`

`html2canvas-pro` is a drop-in fork that supports `oklch`/`oklab`/`color()` and modern CSS. Use it via `jspdf` directly so we control the pipeline:

- Add `html2canvas-pro` and `jspdf` (jspdf is already pulled in by html2pdf — keep it explicit).
- Remove `html2pdf.js` import in `_app.leads.savings.tsx`.
- Replace `exportPDF` with: render `reportRef.current` via `html2canvas-pro` (scale 2, `backgroundColor: "#0f172a"`, `useCORS: true`), then build a multi-page A4/letter `jsPDF` by slicing the canvas. Keep the existing follow-up status update + activity log.
- Wrap in try/catch with a real error toast so future failures surface instead of silently swallowing.

### 2. Rewire "Run AI Analysis" in the savings report

In `_app.leads.savings.tsx`:
- Import `useServerFn` + `analyzeRoofWithAI` from `@/server/lead-ai.functions`.
- Add `const [analyzing, setAnalyzing] = useState(false)`.
- Replace the button's `onClick` so it calls `analyzeRoofWithAI` inline using the selected lead's `lat`/`lng`/`address` (no pin required, `pinCount: 1`). On success, invalidate the leads query so the new `ai_report.analysis` re-renders the observations list. Show loading + toast.
- Remove the navigation to `/leads/wizard` entirely.

### 3. Wizard inline component — same upgrade

In `src/components/leads/RoofWizardInline.tsx`:
- `runAnalysis` should not require pins. If no pins are dropped, fall back to the lead's `lat`/`lng` (already partially handled by `center`). Keep the existing call into `analyzeRoofWithAI`.
- After analysis completes, stay on the lead detail (don't navigate to `/leads/savings` automatically) — or navigate only if the user clicks the existing "Open report builder" button. This stops the disorienting tab-jump and matches the "everything happens inside the lead" workflow you described.

## Files touched

- `src/routes/_app.leads.savings.tsx` — new PDF pipeline + inline AI analysis button.
- `src/components/leads/RoofWizardInline.tsx` — drop the post-analysis redirect, allow analysis without pins.
- `package.json` — add `html2canvas-pro`, ensure `jspdf` is a direct dep, remove `html2pdf.js`.

## Result

- Clicking **Export as PDF** produces a downloaded multi-page PDF of the dark-themed report.
- Clicking **Run AI Analysis** (from the savings report or the lead detail) calls the Claude Vision satellite analyzer in place, writes results to `lead.ai_report.analysis`, and the observations bullets populate the report — no detour through the old wizard tab.
