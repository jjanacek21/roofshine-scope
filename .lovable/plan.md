
# Roof King — Service Ops module

A self-contained service-ops console for the Global Contractor Network company only. Lives at `/roofking` under the existing `_authenticated` layout, uses the existing Anthropic key via a TanStack server function, and adds its own `rk_*` tables so nothing collides with the 90+ existing tables.

## 1. Access scoping (single company only)

- Add a settings flag on `companies`: `is_roof_king boolean default false` (migration).
- Mark exactly one row — the "Global Contractor Network" company — as `is_roof_king = true` via the insert tool.
- Every `rk_*` table gets a `company_id uuid not null` column. RLS policies allow read/write only when `company_id = auth_company_id()` AND the company has `is_roof_king = true`. Super admins get full access.
- The sidebar "Roof King" entry only renders for members of that company (checked via `useProfile` + a small `useIsRoofKing()` hook that reads the flag).
- Route guard in `/_authenticated/roofking.tsx` redirects non-Roof-King users to `/`.

## 2. Database (migration)

Tables, all with `company_id`, `created_at`, `updated_at`, RLS, GRANTs, and the company-scoped policy:

- `rk_accounts` — name, primary_contact, phone, email, city.
- `rk_properties` — account_id FK, name, address, city, state (default 'FL'), zip, roof_type.
- `rk_tickets` — property_id, account_id, wo_number (int, per-company sequence), contact, phone, roof_type, service_date, status enum (`new|dispatched|field|ready|invoiced`), purpose text[], reported_concern, field_notes_raw, report_polished, materials jsonb, labor jsonb, price numeric, completed bool, assigned_to uuid.
- `rk_form_templates` — name, description, fields jsonb, is_custom bool.

Plus:
- Sequence helper `rk_next_wo(_company_id)` SECURITY DEFINER returning `max(wo_number)+1` (starts at 1001).
- `updated_at` trigger reused from existing `update_updated_at_column()`.
- Indexes on `(company_id)`, `(property_id)`, `(account_id)`, `(status)`.
- Seed two default `rk_form_templates` rows (`is_custom=false`) for the Roof King company: "Standard Service Ticket" and "Leak Inspection".

## 3. AI backend (TanStack, not Edge Function)

`src/lib/roof-king-ai.functions.ts`:
- `polishFieldNotes` — `.middleware([requireSupabaseAuth])`, input `{ ticket_id, customer, roof_type, reported_concern, raw_notes }`. Calls Anthropic `claude-sonnet-4-5-20250929` with the office-manager system prompt (Issue → Root Cause → Work Performed → Recommendations, preserve all facts, no invented pricing). Updates `report_polished` and advances status to `ready` if currently `new|dispatched|field`. Returns `{ text }`.
- `generateFormTemplate` — input `{ prompt }`. Calls Claude, instructs JSON-only output, parses, inserts into `rk_form_templates` with `is_custom=true`, returns the saved row.
- Both verify the caller is in the Roof King company before doing work. `ANTHROPIC_API_KEY` is read inside `.handler()` only.

## 4. Routes & UI (TanStack file routes)

All under `src/routes/_authenticated/roofking.*.tsx`:

- `roofking.tsx` — layout: top bar (global search, `+ Customer`, `+ New Ticket`) + left sub-nav (Dashboard, Customers, Pipeline, All Tickets, Form Builder, Export/CRM) + `<Outlet />`.
- `roofking.index.tsx` — **Dashboard**: 5 KPI cards (Customers, Buildings, Total Tickets, Ready to Invoice, In Progress = dispatched+field), Recent Activity list, Pipeline Status horizontal bars per stage.
- `roofking.customers.tsx` — accordion of accounts → buildings → `+ Ticket`. Modals: Add Customer, Add Building.
- `roofking.pipeline.tsx` — 5-column kanban (`@dnd-kit/core`, already in project). Drop updates `rk_tickets.status`. Click card → ticket drawer.
- `roofking.tickets.tsx` — paginated searchable table sorted by `updated_at desc` (page size 50, virtualized with TanStack Query infinite if helpful). Status badge column.
- `roofking.forms.tsx` — Form Builder: prompt textarea + "Generate form with AI" button → calls `generateFormTemplate`. Grid of template cards with "Use template" and "Delete" (custom only).
- `roofking.export.tsx` — client-side CSV: `contacts.csv`, `properties.csv`, `service_tickets.csv` (UTF-8 BOM, ID-linked using `ACCT-` / `PROP-` / `TKT-` prefixed UUIDs). Buttons for each file + "Download all 3" + "Full JSON backup".

Shared components in `src/components/roofking/`:
- `TicketDrawer.tsx` — slide-in right panel with Property block, Reported Concern, editable Field Notes textarea, gold "AI Polish" button, Materials & Labor editors (jsonb), Price input, status stepper (5 stages, click to set). On polish success: toast "Notes polished · moved to Ready for Invoice" and refetch.
- `NewTicketDialog.tsx` — Building selector (grouped by account); on select, auto-fill contact/phone/roof_type from the building's most recent ticket → account fallback. Auto-WO via `rk_next_wo` RPC. Purpose multi-select chips. Reported concern textarea.
- `AccountForm.tsx`, `PropertyForm.tsx` (react-hook-form + zod).
- `KanbanCard.tsx`, `StatusBadge.tsx`, `KpiCard.tsx`.

Data hooks in `src/hooks/roofking/` wrap supabase queries with TanStack Query (`["rk", ...]` keys).

## 5. Design system

Adds Roof-King-specific tokens scoped under `[data-rk]` in `src/styles.css` so it doesn't override the rest of the app:

```text
bg #0c1018 · panel #151b26 · panel2 #1b2330 · line #26303f · line2 #33414f
ink #e8edf4 · ink-muted #9aa7b8 · ink-faint #6b7888
accent #2f81f7 · accent-light #5fa3ff · gold #f0a73a · green #2ec27e · red #f0556b
Status: new #6b7888 · dispatched #2f81f7 · field #a06bff · ready #f0a73a · invoiced #2ec27e
```

Status badges = 16%-opacity tinted pill, solid-color text. Cards: 14px radius, 1px line border, panel bg. Soft radial blue/gold glows on page bg. Sidebar header tile: crown logo on blue gradient reading "Roof King / Service Ops". Buttons: primary blue gradient, gold for AI actions, ghost for panel+border. Subtle hover lift, staggered fade-in, eased drawer slide.

Fonts: Bricolage Grotesque (headings/numbers), Hanken Grotesk (body), JetBrains Mono (WO# / counts). Loaded via `<link>` in `__root.tsx` head (per project rule, never `@import` URLs in `styles.css`).

## 6. Sidebar integration

Add a "Roof King" item in `AppSidebar.tsx` rendered only when `useIsRoofKing()` is true, with a crown icon.

## 7. Acceptance verification

- Empty DB: pages render with empty states.
- Add customer → building → ticket round-trips through Supabase and the UI updates.
- New Ticket auto-fills from last ticket on that building and auto-numbers WO.
- AI Polish updates `report_polished`, flips status to `ready`, toasts.
- Kanban drag persists status.
- Form Builder AI returns valid JSON, persists, renders.
- Export produces three relationally-linked CSVs that can be re-imported.
- All Tickets paginated (50/page) — tested with seeded data.
- Non-Roof-King company members never see the menu and `/roofking` redirects them.

## Out of scope (call out)

- Bulk CSV importer for your existing data — schema is ready; I'll provide a SQL template after the module ships, or wire an importer in a follow-up.
- QuickBooks API push (the "Invoiced" stage is manual for now).
