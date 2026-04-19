
User picked option (b): global Mapbox token via edge function, with a reminder to switch to per-company before scaling past 10 users. Continue Phase B.

Save the reminder to memory, then plan the Phase B build.

## Phase B Plan

### B0. Memory
Save reminder to `mem://index.md` Core: "Mapbox token served via global edge function. Switch to per-company storage before 10+ active companies."

### B1. Mapbox token endpoint
- Server route `src/routes/api.mapbox-token.ts` (GET) — requires auth via `requireSupabaseAuth` pattern, returns `{ token: process.env.MAPBOX_API_TOKEN }`. No CORS needed (same origin).
- `src/hooks/useMapboxToken.ts` — React Query hook fetching the token, 1hr staleTime.
- Install `mapbox-gl` + `@mapbox/mapbox-gl-geocoder` + types.

### B2. Address autocomplete component
- `src/components/maps/AddressAutocomplete.tsx` — wraps `MapboxGeocoder` in a styled input. Emits `{ address, city, state, zip, lat, lng }` on selection. Skeleton while token loads.

### B3. Price Book wizard (`/price-books/new`) — 3 steps
New files:
- `src/routes/_app.price-books.new.tsx` — wizard shell with progress dots
- `src/components/pricebook/MetadataStep.tsx` — name, jurisdiction dropdown, zip chip input, effective month, notes
- `src/components/pricebook/UploadParseStep.tsx` — react-dropzone, xlsx parse first 50 rows, column-mapping UI with auto-detect via `detectColumnMapping()` from `xactimate-parser.ts`
- `src/components/pricebook/MatchConfirmStep.tsx` — 3 tabs (Update / New / Ignored), trade auto-detect using `detectTradeFromCode()`, summary, Confirm button
- Bulk insert: chunk 500 rows via `Promise.all`, upload source to `xactimate-uploads/{company_id}/{ts}-{filename}`, insert price_book → batch insert line_item_master for new → batch insert line_item_prices for all.

### B4. Price Books list (`/price-books`) — full rewrite
Update existing `src/routes/_app.price-books.tsx`:
- 3 stat cards (Active Books, Last Reprice, Total Items Priced)
- Table: name, jurisdiction badge, zip chips, effective_month formatted, item_count, status, created_by/at
- Per-row actions: View (modal with prices), Duplicate & Reprice (→ `/price-books/new?dup=ID`), Toggle Active, Download Source
- "Upload New Book" chrome button → `/price-books/new`

### B5. Client detail page (`/clients/$id`)
New file `src/routes/_app.clients.$id.tsx`:
- Header with client name + contact meta
- Tabs: Properties | Jobs
- Properties: table + "Add Property" drawer using `AddressAutocomplete` + property_type/year_built/roof_type/notes
- Jobs: filtered jobs table + "New Job for this client" → `/jobs/new?client_id=ID`
- Update existing `_app.clients.tsx` rows to link to detail page

### B6. New Job wizard (`/jobs/new`) — 4 steps
New files:
- `src/routes/_app.jobs.new.tsx` — wizard shell, reads `?client_id=` query param to skip step 1
- `src/components/job/ClientStep.tsx` — existing search OR inline new client form
- `src/components/job/PropertyStep.tsx` — selectable property cards or new property form
- `src/components/job/JobDetailsStep.tsx` — auto-gen job_number `JOB-YYYYMM-XXXX` (count this month + 1), primary_trade dropdown, job_type, conditional claim/carrier, notes
- `src/components/job/ReviewStep.tsx` — summary + price book lookup query (filter active where zip in zip_codes, ordered by effective_month DESC), warning if none, Create button
- On submit: insert property if new, insert job with `price_book_id` + `primary_trade`, redirect to `/jobs/$id`

### B7. Sidebar/route updates
- `routeTree.gen.ts` is auto-regenerated, don't touch manually
- Verify sidebar links still resolve

### Files to add: ~14 components, ~6 routes, 1 hook, 1 server route

### Not in this round
Job detail page (Build 3), Mapbox satellite drawing, photo upload, estimate builder, PDF.
