
## Goal

When AI photo analysis turns into estimate line items, stop emitting the same item once per photo. Instead, produce a single deduplicated, roof-system-aware list per job that always includes the standard roof components and Florida code items.

## Current behavior (problem)

- `api/analyze-job-photos` runs per photo and writes `matched_line_items` to that photo row.
- `api/auto-add-photo-suggestions` walks every analyzed photo and inserts one row per `suggested_code` per photo — only deduped by "code already exists on estimate". Two photos of the same flashing both push a flashing line.
- Nothing inspects the roof as a *system*: no guarantee of starter, hip & ridge, field, vents, pipe flashing, drip edge, gutters.
- No Florida code package (double 30# felt + seam tape, butyl perimeter seal, re-nail decking, permit, taxes).

## Plan

### 1. Per-photo prompt — narrower scope, no estimate-builder behavior

Update `src/routes/api.analyze-job-photos.ts` prompt:
- Tell the model "report only what is visible in THIS photo. Do NOT add standard roof components (starter, drip edge, ridge, vents, underlayment, permit) — those are handled at the job level."
- Add explicit `roof_system` enum on the schema when trade=roofing: `laminated_shingle | 3tab_shingle | concrete_tile | clay_tile | metal_standing_seam | metal_screw_down | modified_bitumen | tpo | epdm | spf | coating`.
- Keep `observed_items` for *damage-specific* items only (e.g. "replace 2 SQ shingles", "reset bent ridge vent"), not boilerplate.
- Persist `roof_system` onto `job_photos.ai_analysis` (already a jsonb blob — no schema change needed).

### 2. New job-level roll-up endpoint

New file: `src/routes/api.build-roof-estimate.ts` (POST, auth required, takes `{ job_id }`).

Pipeline:
1. Load all `job_photos` for the job where `status='analyzed'`, plus the job's catalog (company + master, filtered to roofing).
2. **Decide roof system** = majority `roof_system` across photos, tie-break by highest condition_score weight; persist on `jobs.roof_system` (new column).
3. **Decide measurements**:
   - Squares (field): prefer `roof_measurements` table if present; else estimate from photos sum.
   - Linear footage of eaves / rakes / ridge / hip / valley / drip-edge: pull from `roof_measurements` if present, else ask the model in a second small text-only call ("from these tagged photos and any measurements provided, estimate LF of eave/rake/ridge/hip/valley"). Fall back to typical ratios of SQ when missing.
4. **Compose system line items** based on roof_system using a new `ROOF_SYSTEM_TEMPLATES` map (see Technical section). Each template lists required codes with qty formulas: field = SQ, starter = LF eaves+rakes, hip & ridge = LF hip+ridge, drip edge = LF eaves+rakes, pipe flashing = count from photos (default 2), gutters = LF eaves (only when photos show gutters / job has gutters flag).
5. **Merge damage items** from photos: dedupe by code, take MAX qty across photos (current behavior already does this for codes — keep, but only after the system items are in place).
6. **Append Florida code package** (always on for `state=FL` companies; toggle off-able per-estimate):
   - `FL-FELT-30-DBL` Double 30# felt underlayment w/ seam tape — qty = SQ
   - `FL-PERIM-BUTYL` Butyl rubber perimeter seal — qty = LF eaves+rakes
   - `FL-RENAIL` Re-nail roof decking to current FBC — qty = SQ
   - `FL-PERMIT` Building permit & inspection — qty = 1 LS
   - `FL-TAX` Sales tax on materials — computed at totals time, not as line
7. Return preview JSON: `{ system, items: [{code,name,qty,unit,unit_price,source}] }`. Caller (UI or auto-add) inserts via existing estimate insert path.

### 3. Wire it into the existing UX

- Replace `api/auto-add-photo-suggestions` call inside `analyze-job-photos.ts` with a debounced trigger to `api/build-roof-estimate` (only when company toggle is on).
- `AISuggestionsPanel.tsx`: fetch from the new endpoint (`useQuery(['ai-roof-estimate', jobId])`) instead of walking `matched_line_items`. Show one row per code with where it came from (System / Damage / FL Code).
- Add an "Recompute" button so the user can re-run after uploading more photos.

### 4. Schema

Migration `add_roof_system_and_fl_code_items`:
- `jobs.roof_system text null`
- `companies.include_fl_code_package boolean default true`
- Seed `line_item_master` (company_id NULL = master) with the 5 `FL-*` codes above and the standard roof component codes used by the templates that don't already exist (idempotent insert by code).

### 5. Out of scope

- Tax math itself (already handled by `EstimateTotalsPanel`).
- Non-roofing trades — they keep current per-photo behavior. Only roofing gets the system roll-up in this pass.

## Technical details

`ROOF_SYSTEM_TEMPLATES` lives in new `src/lib/roof-system-templates.ts`:

```text
laminated_shingle:
  field        RFG-LAM-COMP   qty=SQ           unit=SQ
  starter      RFG-STARTER    qty=LF_eave+rake unit=LF
  hip_ridge    RFG-HIPRIDGE   qty=LF_hip+ridge unit=LF
  drip_edge    RFG-DRIPEDGE   qty=LF_eave+rake unit=LF
  ridge_vent   RFG-RIDGEVENT  qty=LF_ridge     unit=LF (only if exhaust vent type=ridge)
  off_ridge    RFG-OFFRIDGE   qty=count        unit=EA (only if box vents seen)
  pipe_flash   RFG-PIPEBOOT   qty=count        unit=EA
  valley_metal RFG-VALLEY     qty=LF_valley    unit=LF
  gutters      EXT-GUTTER-6   qty=LF_eave      unit=LF (only if has_gutters)

concrete_tile / clay_tile: same shape, codes RFG-TILE-*, plus eave closure + tile starter + battens.

metal_standing_seam / metal_screw_down: RFG-METAL-* + closure strips + clips.

modified_bitumen: RFG-MODBIT-* + base sheet + cap sheet + edge metal + walk pads.
```

Photo dedupe rule used by the roll-up:

```text
For each unique suggested_code across all photos:
  qty = max(qty_in_photo_i)   // not sum
  source = 'ai_photo'
Items already covered by system template are skipped (system wins).
```

Files to touch:
- new `src/routes/api.build-roof-estimate.ts`
- new `src/lib/roof-system-templates.ts`
- new migration
- edit `src/routes/api.analyze-job-photos.ts` (prompt + schema + remove direct auto-add call)
- edit `src/components/estimate/AISuggestionsPanel.tsx` (consume new endpoint)
- edit `src/routes/_app.jobs.$id.estimate.tsx` (Recompute button)
