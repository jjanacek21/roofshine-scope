## Why the dashboard says 1,000

Supabase silently caps every `.select()` at 1,000 rows. `useLeads` uses a plain `.select("*")`, so the dashboard, list, pipeline, and map all stop counting at 1,000. Once the full CSV is re-imported (1,264+ leads), every screen will be wrong by the same logic.

## Fix

### 1. `src/hooks/useLeads.ts`
- Replace `useLeads` with a paginated version: loop `.range(from, from + 999)` until a short page returns. Result: every lead loads, regardless of total.
- Add a new `useLeadStats` hook that uses `select('*', { count: 'exact', head: true })` per status. Head-only counts are fast (no rows transferred) and accurate even at 100k+ leads. It also pages through `won` leads to sum `estimated_value` for the pipeline value KPI.

### 2. `src/routes/_app.leads.index.tsx` (Dashboard)
- Switch the four StatCards (Total / Contacted / Qualified / Won) to read from `useLeadStats` instead of derived counts on the in-memory list.
- Keep `useLeads` only for the "Recent Leads" table and charts (charts already only need the list; recent table slices `.slice(0, 10)`).
- Pipeline bar chart: build from `stats.byStatus` so it reflects the true totals.
- Monthly imports chart: keep using paged `useLeads` data — fine now that pagination works.

### 3. `src/server/leads.functions.ts` — `listFollowUps`
- Replace the single `.limit(2000)` with a paged loop over `lead_activities` where `type = 'report_sent'` so the Follow-Up tab also scales beyond 1k sends.

No schema changes, no migrations. Pure read-side fixes. After this lands, re-import yesterday's CSV and the dashboard will correctly show the full count.