
You're restarting with a brand new direction — **BuildScopeAI**, a multi-trade contractor estimating app — and you've told me the prototype HTML is the authoritative visual spec. Before I touch any code, two things need to be settled.

## What I noticed

1. **The prototype HTML hasn't arrived yet.** You said "THE PROTOTYPE HTML IS IN MY NEXT MESSAGE." Without it I'd be guessing at the exact CSS variables, gradients, fonts, sidebar styling, and chrome logo — which directly contradicts your #1 rule: "DO NOT reinvent the design."
2. **The 15 tables you described don't exist.** The current database only has an `estimates` table from the previous build. You also said "DO NOT create migrations." Those two facts conflict, so I need direction.
3. **The current codebase is a different app.** Routes like `/app/estimates`, `/app/customers`, the GCN Estimator branding, and the marketing landing all need to be wiped before I lay down the BuildScopeAI route tree.
4. **Tech note:** This project runs on TanStack Start (file-based routing in `src/routes/`), not plain Vite + React Router. URLs (`/login`, `/jobs`, `/`) stay identical — only the file naming convention changes (`_app.jobs.index.tsx`, etc.).

## My proposed plan (once you unblock me)

### A. Foundation
- Delete old GCN routes and components
- Drop the prototype's `:root` CSS variables verbatim into `src/styles.css`
- Re-map the `@theme inline` block so Tailwind `primary` → `--brand`, `background` → `--bg`, etc.
- Load Archivo + JetBrains Mono + Instrument Serif from Google Fonts in `__root.tsx`
- Create `src/lib/trades.ts` exactly as you specified (8 trades, colors, helpers)

### B. Shared chrome
- `<Logo>` — chrome "B" mark + "BuildScope / AI" stacked wordmark
- `<AppSidebar>` — 240px dark vertical gradient, active nav with blue gradient + inset left border, user chip, collapses to 70px <1100px
- `<Topbar>` — 64px sticky, backdrop-blur
- `<MobileBottomTabs>` — shown <700px
- `<TradeBadge>`, `<StatusBadge>` — tinted bg + border
- `<StatCard>` — radial blue glow top-right
- `<TradeMixBar>` — 8-segment horizontal stacked bar + legend

### C. Routes (TanStack Start naming)
```text
src/routes/
  __root.tsx
  login.tsx               -> /login
  signup.tsx              -> /signup
  onboarding.tsx          -> /onboarding
  _app.tsx                (auth guard + sidebar/topbar layout)
  _app.index.tsx          -> /          Dashboard
  _app.jobs.index.tsx     -> /jobs      Kanban (7 cols, dnd-kit)
  _app.jobs.$id.tsx       -> /jobs/:id  Overview placeholder
  _app.clients.tsx        -> /clients
  _app.catalog.tsx        -> /catalog
  _app.price-books.tsx    -> /price-books
  _app.settings.tsx       -> /settings  (Company / Branding / Defaults / Trades / Users / Integrations tabs)
```

### D. Phase 1 features
Auth → 3-step Onboarding (Account ✓ / Company / Trades) → Dashboard (greeting, 4 stat cards, trade mix bar, recent jobs) → Jobs Kanban with drag-drop status updates → Clients table → Catalog table with trade badges → Price Books list → Settings tabs (Trades multi-select wired to `companies.trades`).

### E. Stubs (per your spec)
New Job button, Xactimate import, photo upload + AI, PDF generation, Mapbox, Job detail tabs (Measurements / Photos / Estimate / Report) — all stubbed with toasts or placeholder drawers.

### F. Verification
Walk your checklist item-by-item (chrome B logo, #0a0a0b bg, sidebar gradient, blue-gradient active nav with inset border, radial glow stat cards, JetBrains Mono numbers, Archivo headings, blue-gradient buttons with glow, chrome metallic "New Job" button, tinted status/trade badges) before declaring done.

## I need two answers before I write a single line

**1. The prototype HTML — when do I get it?**
- (a) Paste it in your next message and I'll wait. **(strongly recommended — matches your "design is non-negotiable" rule)**
- (b) Start the foundation now (clear old app, set up route shells, fonts, trade constants) and apply the prototype CSS the moment you paste it.

**2. Database approach — your "DO NOT create migrations" instruction conflicts with the missing tables.**
- (a) **Create migrations for the Phase 1 subset now** — `companies`, `users` (extension of auth.users via profiles pattern), `clients`, `jobs`, `line_item_master`, `price_books`, `estimates`, `estimate_line_items` — with RLS keyed off an `auth_company_id()` helper. Real data from day one. (Recommended — Phase 1 reads/writes won't work otherwise.)
- (b) **Mock everything.** No DB queries this pass; every page renders against static arrays. Wire to real tables in a follow-up.
- (c) **Hybrid:** real tables for `companies` / `users` / `clients` / `jobs` (so auth + onboarding + dashboard + Kanban work), mock for catalog / price books / estimates.

Reply with your two picks (and paste the HTML if going with 1a) and I'll execute.
