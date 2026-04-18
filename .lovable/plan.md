
This is a massive, well-specified Build 2. Let me check current state of relevant tables/routes before planning to make sure my plan aligns with what's actually there.

I already have schema knowledge from the system context:
- `companies` (has `trades` array, no `default_jurisdiction`)
- `clients` (has name/email/phone/address/notes — **no `properties` table exists**)
- `jobs` (has `primary_trade`, `client_id`, `property_address`, `status`, `total_estimate` — **no `property_id`, no `price_book_id`, no `job_type`, no `claim_number`, no `insurance_carrier`, no `job_number` is text but exists**)
- `line_item_master` (code, name, trade, category, unit, waste_pct, default_price, status, company_id — **no description, no tags**)
- `price_books` (name, source, region, status, item_count — **no `jurisdiction`, no `zip_codes`, no `effective_month`, no `is_active`, no `notes`, no `source_file_url`, no `created_by`**)
- **No `line_item_prices` table** (the join between price_book and line_item_master with price)
- **No `properties` table**
- **No `companion_rules` table**

So the spec implies a lot of NEW tables and columns. I need to plan migrations carefully.

Let me also check existing files quickly for the routes I'd touch.

## Scope reality check

This spec is enormous: 4 wizards, 1 admin tab, 8+ new pages, 14+ new components, 5 npm packages, Mapbox integration, Excel parsing, bulk inserts, dashboard rewrite, ~37 seed rules. Realistically this is 3–4 build rounds of work, not one. I'll plan it as **one cohesive plan but in two phases** so the first phase gets shipped working before we layer on the heavier stuff.

I also need to ask about a few decisions before building.

## The Plan

### Phase A — Data foundation + core admin (this round)

**A1. Database migration (one big migration)**

New tables:
- `properties` — id, client_id, company_id, address, city, state, zip, lat, lng, property_type, year_built, roof_type, notes, timestamps. RLS by company.
- `line_item_prices` — id, price_book_id, line_item_master_id, unit_price, labor_pct, material_pct, equipment_pct. RLS via parent price_book company.
- `companion_rules` — id, company_id, trigger_category, trigger_trade, suggested_codes (text[]), rule_type (enum: required/recommended/conditional), jurisdiction, notes, timestamps. RLS by company.

Schema additions:
- `line_item_master`: add `description text`, `tags text[]`
- `price_books`: add `jurisdiction text`, `zip_codes text[]`, `effective_month date`, `is_active bool default true`, `notes text`, `source_file_url text`, `created_by uuid`
- `jobs`: add `property_id uuid`, `price_book_id uuid`, `job_type text`, `claim_number text`, `insurance_carrier text` (job_number already text). Index on `(company_id, primary_trade)` already implied — verify and add.
- New enum `companion_rule_type` ('required','recommended','conditional')

Storage bucket: `xactimate-uploads` (private), with RLS so users can only access their own company's folder.

**A2. Catalog admin (`/catalog`) — full rewrite**
- Filters bar: debounced search, multi-select trade popover, multi-select category, active-only toggle, count, "Add Line Item"
- Add/Edit drawer with full form, code uniqueness check
- Row actions: edit, view price history (recharts modal querying `line_item_prices`), mark inactive (confirm dialog)
- Bulk-select column with action bar (mark active/inactive, export CSV)
- "Current Price" column joins to active price book via `line_item_prices`

**A3. Companion Rules tab in Settings**
- New tab in `/settings`
- List + drawer form
- "Load starter rules" empty-state modal: bulk-inserts the 37 rules from the spec (suggested_codes are placeholder category names, editable later)

**A4. Dashboard updates**
- Real queries for Active Jobs, Total Estimates, Total Quoted MTD, Avg Job Value (30d)
- Trade Mix grouped by `jobs.primary_trade`
- Recent Jobs joined to latest estimate

**A5. Packages**
- `xlsx`, `react-dropzone`, `recharts`, `date-fns` (install all)
- Mapbox stays for Phase B

### Phase B — Wizards (next round, after Phase A is verified)

**B1. Price Book upload wizard (`/price-books/new`)** — 3 steps
- Stats cards on `/price-books` list
- Wizard: metadata → upload+parse+column-mapping → match+confirm with 3 tabs (update/new/ignored)
- Auto-detect Xactimate trade prefixes via `src/lib/xactimate-parser.ts`
- Bulk insert in 500-row chunks via `Promise.all`
- Per-row actions (view, duplicate-and-reprice, toggle active, download source)

**B2. Client detail page (`/clients/$id`)**
- Header + Properties tab + Jobs tab
- Add Property drawer with Mapbox geocoding (asks for token first time, stores in localStorage)

**B3. New Job wizard (`/jobs/new`)** — 4 steps
- Client (existing/new) → Property → Details → Review
- Auto-assigns `price_book_id` by zip lookup against active price books
- Warns + still creates if no match

**B4. Mapbox**
- Install `mapbox-gl` + `@mapbox/mapbox-gl-geocoder`
- Token prompt UI on first use, saved to `localStorage`

### What I'm explicitly NOT doing
- Job detail tabs, photo upload/Claude analysis, estimate builder, PDF proposal, satellite map drawing — those are Build 3 per the spec
- Edge function for >5000-row imports — spec says optional, defer until needed

## Two questions before I start

I need answers on these because they materially change the schema and UX:

**Q1 — Phasing.** This is a big spec. Do you want me to:
- (a) Do **Phase A only** this round (catalog admin, rules tab, dashboard, all schema/migrations) — ships solid working pieces fast, then Phase B next round
- (b) Do **everything in one giant round** — much higher risk of partial breakage, harder to verify

**Q2 — Mapbox token.** You already have `MAPBOX_API_TOKEN` configured as a Supabase secret. Should I:
- (a) Read it from the `companies` table per-tenant (you set it once in Settings; shown to all users in that company)
- (b) Use the global secret via a tiny edge function that returns it to the client (so you don't have to manage per-company)
- (c) Per-user `localStorage` prompt as the spec says (works but every user has to paste a token)

The spec says (c), but you have the token already — (b) or (a) is much better UX.
