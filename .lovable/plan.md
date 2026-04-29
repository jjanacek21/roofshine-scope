## Why analysis fails today

Network logs show every `/api/analyze-job-photos` call returning **502** with:
> `invalid model: anthropic/claude-sonnet-4-5`

The Lovable AI Gateway dropped that alias. Allowed vision models are now `google/gemini-2.5-pro`, `openai/gpt-5`, etc. Because the call 502s before the DB write, `job_photos.ai_analysis` and `matched_line_items` stay empty — that's why no damage report appears, no line items populate, and the photo never looks "saved with analysis."

The same broken id is in **three** server routes:
- `src/routes/api.analyze-job-photos.ts` (per-photo analysis)
- `src/routes/api.analyze-property.ts` (the "Analyze property" consolidated run)
- `src/routes/api.analyze-roof-condition.ts` (uses direct Anthropic API — that one is fine, different code path)

## Why "Upload Photos" button does nothing on iOS

`PhotoUploader.tsx` uses a single `<input type="file" multiple accept="image/*">` triggered by the Upload button, and a separate `capture="environment"` input for the camera button. On iOS Safari, when `accept="image/*"` is set without `capture`, tapping the input opens the iOS sheet that includes Photo Library — but our hidden input is rendered with `className="hidden"` (display:none). iOS Safari refuses to open the picker on inputs that are `display:none` in some flows; it requires the input to be visually hidden but rendered (opacity:0 / sr-only). That matches what you're seeing — drag-drop works, but tapping the button doesn't open the Photos picker.

## Changes (3 small fixes, no scope creep)

### 1. Swap the broken model id in both photo endpoints
In `api.analyze-job-photos.ts` line 147 and `api.analyze-property.ts` line 234:
```
model: "anthropic/claude-sonnet-4-5"  →  model: "google/gemini-2.5-pro"
```
Gemini 2.5 Pro is the strongest allowed multimodal model on the gateway and supports the same `tool_choice` / function-calling shape we already use. No prompt changes needed.

### 2. Make the Upload Photos input iOS-friendly
In `src/components/jobs/PhotoUploader.tsx`, change both hidden inputs from `className="hidden"` to a visually-hidden but rendered style:
```
className="sr-only"
// or: style={{ position:'absolute', width:1, height:1, opacity:0, pointerEvents:'none' }}
```
This is the standard fix for iOS Safari refusing to trigger file pickers on `display:none` inputs.

### 3. Add a clearer error surface so silent failures stop happening
In `JobPhotosPanel`/`PropertyAnalysisPanel` (whichever calls `/api/analyze-job-photos`), when the response is non-2xx, parse `{error, detail}` and `toast.error()` it instead of swallowing. This prevents the next API breakage from looking like "analysis ran but nothing happened."

## What I will NOT change
- No DB migrations.
- No new tables / new components.
- No changes to upload pathing, RLS, or storage layout.
- `api.analyze-roof-condition.ts` is untouched — it uses the direct Anthropic API key, not the gateway, and is unrelated.

## Acceptance
- Tapping **Upload Photos** on iPhone opens the Photos picker.
- After upload + Analyze, each photo gets `ai_analysis` populated, the damage report renders, and consolidated suggestions appear in `PropertyAnalysisPanel` so "Add selected to estimate" works.
- A failed gateway call shows a red toast with the gateway's error message instead of silently "completing."