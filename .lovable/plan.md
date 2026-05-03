## Problem

When you click **Run AI Analysis** on the Savings Report, the toast says "observations updated" but the **Roof Observations** section stays empty.

## Root cause

I checked the lead in the database (`4a758e37-…`). Its `ai_report` column currently contains **only `measurements`** — no `analysis` field. There are two bugs causing this:

1. **`analyzeRoofWithAI` overwrites `ai_report` instead of merging it.**
   In `src/server/lead-ai.functions.ts` the handler does:
   ```ts
   .update({ ai_report: { analysis: text, generated_at, lat, lng } })
   ```
   This replaces the whole JSON column. So running measurements wipes the analysis, and running analysis wipes the measurements. Whoever ran last wins — in this lead's case, measurements ran last and erased the analysis text, which is why the Observations list is empty even though the call succeeded.

2. **Savings page reads from a stale cached lead.**
   `useLeads()` returns the full list and the page derives `aiObservations` from `lead.ai_report.analysis`. After the analysis call we invalidate `["leads"]`, but the toast fires *before* the new data is in the cache, and the parsed-bullets heuristic (`length < 220`, strips leading `[-•*\d]`) is also too strict — Claude's output is one or two long paragraphs, so most lines are filtered out and the section renders empty even when `analysis` *is* present.

## Fix

**1. Merge instead of overwrite (`src/server/lead-ai.functions.ts`)**
- Before updating, `select ai_report` for the lead, then write `{ ...existing, analysis, analysis_generated_at, lat, lng }`. Same pattern the inline wizard already uses for measurements.
- Return `{ analysis, image_url }` (already does).

**2. Make Observations actually render the analysis (`src/routes/_app.leads.savings.tsx`)**
- Replace the brittle bullet-extraction heuristic with a real parser:
  - Split on blank lines into paragraphs.
  - For lines starting with `-`, `•`, `*`, or `1.`/`2.` style, treat as list items.
  - Otherwise, split paragraphs into sentences and take the first 6–8 substantive ones.
- Always show *something* when `analysis` is non-empty; fall back to the raw `analysis` text in a paragraph if no bullets are found, so the section is never silently blank.
- Show a small "Generated <date>" caption under the heading when present.

**3. Refresh the page after analysis**
- After `analyze(...)` resolves, `await qc.refetchQueries({ queryKey: ["leads"] })` (refetch, not just invalidate) so the parsed observations appear immediately on the next render.

## Files touched
- `src/server/lead-ai.functions.ts` — merge `ai_report` JSON instead of overwriting
- `src/routes/_app.leads.savings.tsx` — robust observations parser + refetch on success

No DB migrations or new dependencies.