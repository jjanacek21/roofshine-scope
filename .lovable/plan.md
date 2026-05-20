# Survival Guide + Sidebar Reorder

Add the **Blue Collar Sales Survival Guide** as a new in-app section, and reorder the main nav.

## Sidebar order

Workspace nav becomes, top to bottom:

1. Dashboard (`/`)
2. Clients (`/clients`)
3. Jobs (`/jobs`)
4. Prospector (`/leads`)
5. My Card (`/card`)

Then a visual separator and at the bottom of the workspace list:

6. **Survival Guide** (`/survival-guide`) — `BookOpenText` icon, subtle accent so it reads as a separate "resources" item, not workspace data.

Mobile bottom tabs (5 slots): Dashboard, Jobs, Prospector, Clients, Survival Guide. (Settings stays reachable from the user menu.)

## Survival Guide page

New route `/survival-guide` (under the authenticated `_app` layout, so it inherits the existing chrome).

Approach: ship the uploaded guide as a **static HTML asset** and render it inside a full-height styled iframe. This preserves the guide's left-nav, sections, search box, accordions, and copy-to-clipboard buttons exactly as designed — no content reflow, no risk of breaking 2,500 lines of curated copy.

- Copy `blue-collar-sales-survival-guide.html` into `public/survival-guide/index.html`.
- Route file `src/routes/_app.survival-guide.tsx` renders a page header ("Survival Guide — Blue Collar Sales") plus an `<iframe src="/survival-guide/index.html">` that fills the viewport minus the app header.
- Iframe styled with `border: 0`, `width: 100%`, `height: calc(100vh - <header offset>)`, dark background to match app while it loads.
- SEO/head: title "Survival Guide — globalcontractor.app", description from the guide intro.

The richer schema-backed version described in `lovable-prompt-sales-playbook.md` (Supabase tables, damage checklist → estimator bridge, analytics, Cmd+K search) is **out of scope for this pass**. We can layer it on later without changing the route URL. The iframe already gives reps the full content today.

## Files to touch

- `src/components/layout/AppSidebar.tsx` — reorder `WORKSPACE_NAV`, append Survival Guide entry with a small top border above it.
- `src/components/layout/MobileBottomTabs.tsx` — new 5-tab set above.
- `src/routes/_app.survival-guide.tsx` — new route, iframe wrapper.
- `public/survival-guide/index.html` — copied verbatim from upload.

## Out of scope

- Database tables for sections/cards/scripts
- Damage checklist → estimator prefill
- Per-rep analytics on script copies
- Global Cmd+K search across guide content
- Per-org content editing

These remain available as Phase 2/3 follow-ups when you want to invest in deeper integration.
