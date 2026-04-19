
This is a meaty feature request. Let me unpack what's actually being asked.

## Decomposing the request

User wants:
1. **Master admin portal** — upload price list **PDFs** (not Xactimate spreadsheets) per zip code/region
2. **AI extracts pricing** from those PDFs into structured line items (zip-coded)
3. **Photo → line item matching** — when end user uploads job photos, AI matches what's visible to line items in the price book for that zip
4. **Prompt for extra details** — quantity, size, dimensions… **except roofing**, where measurements should already exist (from a roof report — EagleView, Hover, manual sketch?)
5. **Manual product search** — type product name → add to estimate (for things not photographed)
6. **AI suggests companion line items** — based on what's already on the estimate + photos + trade + insurance requirements + building codes

## What already exists

From schema/files I can see:
- `price_books` + `line_item_prices` + `line_item_master` — already wired for Xactimate xlsx upload
- `companion_rules` table — manual rule system, not AI-driven yet
- `properties` with lat/lng/zip
- `jobs` linked to `price_book_id` (auto-resolved by zip)
- `estimates` + `estimate_line_items`
- `LOVABLE_API_KEY` available → Lovable AI (Gemini/GPT-5 with vision)
- `xactimate-uploads` storage bucket (private)
- No `job_photos` table, no roof measurements table, no AI suggestion log

## Three big gaps

**Gap 1 — PDF parsing.** Xactimate xlsx parsing is already built. PDF price lists are different. PDFs need either text extraction + LLM structuring, or vision-LLM page-by-page. PDFs from carriers/manufacturers vary wildly in format. Solution: edge function that downloads the PDF, runs it through Gemini 2.5 Pro (vision + long context), uses tool-calling to return `[{code, name, unit, unit_price, category, …}]`. Then UI shows a review/match step (just like the existing xlsx wizard's step 3) before commit.

**Gap 2 — Master admin scope.** Currently price books are company-scoped (`company_id` required). User wants **master admin** to upload price lists that apply across companies (or at least a "platform price book" that companies can adopt). Need a decision: are these admin-uploaded books **shared/global** or **per-company seeded by admin**?

**Gap 3 — Roof measurements.** "Don't prompt for size if it's the roof, you should have measurements." Where do measurements come from? Three options:
- (a) User uploads a roof report PDF (EagleView/Hover/RoofR) → AI extracts squares/LF/pitch
- (b) Manual sketch tool (out of scope this round)
- (c) User types them in a roof-measurements form once per property

## Things to ask the user before planning further

I'll group into 3 questions max so we don't ping-pong.

## Plan once decided

**Phase 1 — PDF price book ingestion (admin)**
- New route `admin.price-lists.tsx` (super_admin only)
- Upload PDF → store in new `admin-price-lists` bucket
- Edge function `extract-price-list-pdf`: pulls PDF, sends to `google/gemini-2.5-pro` with vision + tool-calling, returns line items
- Review screen with same 3-tab match/confirm UI as xlsx flow
- Commit creates a `price_books` row (with new flag `is_global = true` and `company_id = null` allowed) + `line_item_prices`
- RLS: global price books readable by all authenticated users

**Phase 2 — Photo analysis + line item suggestion**
- New `job_photos` table (job_id, storage_path, ai_analysis jsonb, created_at)
- New storage bucket `job-photos` (private, company-scoped path)
- Estimate builder UI: photo gallery + "Analyze with AI" button
- Edge function `analyze-job-photos`:
  - Inputs: photo URLs, job's `price_book_id`, primary trade, current estimate line items
  - Sends to `google/gemini-2.5-pro` with vision + structured output
  - Returns: `{detected_items: [{matched_line_item_id, confidence, needs_dimensions: bool, suggested_qty?, notes}], companion_suggestions: [{code, reason, code_or_insurance_basis}]}`
- For each detected item: if `needs_dimensions` → modal asks user for qty/size; if trade is roofing AND roof measurements exist → auto-fill; otherwise prompt
- Add to estimate via existing `estimate_line_items` insert

**Phase 3 — Roof measurements**
- New `roof_measurements` table on `properties` (squares, eaves_lf, rakes_lf, ridges_lf, hips_lf, valleys_lf, pitch, source: 'manual'|'eagleview'|'hover')
- Either manual form OR upload report PDF → AI extract (similar to price list flow)

**Phase 4 — Manual line item search + add**
- Estimate builder: typeahead search across active price book's line items by code/name
- Add → estimate row, prompt for qty (or use measurement if roofing)

**Phase 5 — Companion suggestions**
- After each line item added/photo analyzed, fire `suggest-companion-items` edge function
- Inputs: current estimate items, trade, jurisdiction, photos
- Prompt the AI specifically about insurance carrier requirements (dump fees, permits, code-required items) + Florida building code essentials
- Surface suggestions as a sidebar "Recommended additions" with one-click add

**Database additions needed**
- Allow `price_books.company_id` to be nullable + add `is_global boolean default false` + adjust RLS so global books are readable by all
- New tables: `job_photos`, `roof_measurements`
- New storage buckets: `admin-price-lists` (private, super_admin), `job-photos` (private, company-scoped)

**Edge functions needed**
- `extract-price-list-pdf` (PDF → structured line items)
- `analyze-job-photos` (photos + price book → matched items + suggestions)
- `extract-roof-report` (optional, for EagleView/Hover PDFs)
- `suggest-companion-items` (current estimate → recommended additions)

All four will use Lovable AI Gateway with `google/gemini-2.5-pro` (vision + long context + tool-calling).

## Scope reality

This is realistically **3 build rounds**, not one. I'll propose splitting:
- **Round 1**: Admin PDF price-list upload + extraction + global price book support
- **Round 2**: Job photos table/upload + photo-to-line-item matching + manual product search in estimate
- **Round 3**: Roof measurements + AI companion suggestions sidebar

Need answers to 3 questions before kicking off Round 1.
