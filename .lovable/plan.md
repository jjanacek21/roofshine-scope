## GCN Lead Center — Plan

A new "Leads" section inside this app, adapted to your existing stack (TanStack Start, Mapbox, dark theme tokens, server-side secrets, company/admin RLS). Imports are restricted to company `owner` / `admin` / `super_admin` — you already qualify on both your accounts.

Built in 3 phases matching your prompts.

---

### Phase 1 — Core: DB, navigation, dashboard, list, map, kanban, CSV import

**Database (migration):**
- `leads` — `company_id`, address fields, sqft, year_built, lat/lng, roof_type, property_type, status (`new`|`contacted`|`qualified`|`quoted`|`won`|`lost`), estimated_value, sale_amount, reported_owner, ai_report jsonb, created_by, timestamps
- `lead_contacts` — `lead_id`, name, title, company, sort_order
- `lead_contact_phones` — `contact_id`, phone, phone_type
- `lead_contact_emails` — `contact_id`, email
- `lead_notes` — `lead_id`, user_id, content
- `lead_activities` — `lead_id`, user_id, type, note
- `playbook_preferences` — `user_id`, selected_sections text[]
- RLS: company members read/write their company's rows; only `is_company_admin()` (owner/admin) or `is_super_admin()` can INSERT into `leads` (gates CSV import). All child tables scoped via parent `lead_id`.
- No `api_keys` table — using existing `GOOGLE_MAPS_API_KEY`, `ANTHROPIC_API_KEY`, `MAPBOX_API_TOKEN` server secrets.

**Navigation:**
- Add "Leads" section in `AppSidebar` with sub-items: Dashboard, Map, List, Pipeline, Import, AI Roof Wizard, Savings Report, Training Center.
- Routes under `src/routes/_app.leads.*.tsx` (gated by existing `_app` auth + company check).

**Views (all use existing dark theme tokens, Archivo/JetBrains Mono, StatCard, StatusBadge):**
- `/leads` (Dashboard) — 4 StatCards (Total / Contacted / Qualified / Won pipeline $), 2 charts using `recharts` (already in project), Recent Leads table.
- `/leads/map` — Mapbox GL (reuse `useMapboxToken`) with satellite style, lead markers colored by status, right-side scrollable list panel.
- `/leads/list` — Status filter tabs, sortable table, row actions (call/email/text/AI/details).
- `/leads/pipeline` — 6-column kanban, drag-and-drop with `@dnd-kit/core` (add dep), drop updates status.
- Lead detail = right-side `Sheet` (existing component): property info, contacts with tel/mailto pills, mini Mapbox satellite preview, quick actions, note input, activity log.

**CSV Import (`/leads/import`, admin-only route guard):**
- Drag-drop + browse, parse with `papaparse` (add dep).
- Server function `importLeads` (uses `requireSupabaseAuth`, re-checks `is_company_admin`) — accepts parsed rows, supports both Reonomy formats, splits pipe-delimited phones/emails, parses `address_full`, creates leads + contacts + phones + emails in batch.
- Optional geocoding via existing `GOOGLE_MAPS_API_KEY` server-side when lat/lng missing.
- "Load sample data" button seeds 15 South Florida properties.

---

### Phase 2 — AI Roof Wizard + Savings Report

**AI Roof Wizard (`/leads/wizard`, also openable from any lead):**
- Address input with Mapbox geocoding autocomplete (reuse existing `AddressAutocomplete`).
- Mapbox GL satellite map, click-to-drop numbered draggable pins (reuse patterns from `MapboxRoofDraw`).
- "Get Roof Measurements" → server function calls Google Solar API server-side using `GOOGLE_MAPS_API_KEY` (Solar API enabled per memory). Returns total sqft, segment breakdown, pitch, sun hours.
- "Analyze with AI" → server function fetches Google Static Maps satellite image server-side, sends to Claude via existing `ANTHROPIC_API_KEY` (claude-sonnet-4-5-20250929 per memory). Streams analysis back. Saves result to `leads.ai_report` if invoked from a lead.

**Savings Report (`/leads/savings`):**
- Pure client component with sqft / roof type / age inputs.
- Cost comparison cards, Immediate Savings highlight, 20-year breakdown bar chart (recharts), ROI stats, "Why Spray Foam" feature list.
- "Export PDF" reuses existing `pdf-generator.ts` patterns.

---

### Phase 3 — Training Center + Floating Call Playbook

- `src/lib/playbook-content.ts` — all 9 categories (philosophy, masterScript, rebuttals, productTalk, roofTypes, icebreakers, scenarios, tonality, quickRef, training) with full script content from prompt 3.
- `/leads/training` — modal/page, left category nav with "in playbook" green dot, right scrollable accordion sections, "Add to Playbook" toggle (writes `playbook_preferences`).
- `<CallPlaybookPanel>` — fixed, draggable, right-side floating panel rendered at app layout level. Opens when any "Call" button is clicked. Shows lead context + collapsed accordions for user's selected sections. Non-blocking, z-indexed above content.

---

### Technical notes

- **Deps to add:** `papaparse`, `@dnd-kit/core`, `@dnd-kit/sortable`. Charts use existing `recharts`. Maps use existing Mapbox GL setup. PDFs use existing generator.
- **Colors:** Status colors mapped to existing semantic tokens in `src/styles.css`; not introducing slate/green hex values.
- **Auth gating:** `_app` already redirects unauthenticated. Import route additionally calls `useIsCompanyAdmin()` and 403s otherwise. Server function double-checks role.
- **No client-side AI keys.** All Anthropic / Google Solar / Geocoding calls go through `createServerFn` handlers using `process.env.*`.
- **Realtime status updates:** Pipeline drag mutations invalidate React Query keys so all views stay in sync.
- **Memory update:** Add lead-management entry to `mem://index.md` after build.
