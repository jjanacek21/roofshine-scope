
The user pasted the prototype HTML (truncated mid-stream but with all the CSS variables, the login screen, the onboarding wizard, the sidebar markup, the dashboard, stats grid, trade-mix card, recent-jobs table, and partial markup for measurement/photos/estimate/report views).

Let me reconcile what I built (foundation pass with my own dark-theme defaults) against what the prototype actually specifies, then plan a focused refit.

## Variable diffs (mine vs prototype)

| Token | Mine | Prototype | Action |
|---|---|---|---|
| `--bg` | `#0a0a0b` | `#0a0a0b` | match |
| surface card | `--surface #111114` | `--bg-card #1a1a1d` | rename + adjust |
| elevated | `#16161a` | `--bg-elevated #131316` | adjust |
| hover | `#1c1c21` | `--bg-hover #202024` | adjust |
| border | `rgba(255,255,255,.08)` | `#27272a` (solid) | adjust |
| border-strong | `rgba(255,255,255,.14)` | `--border-bright #3f3f46` | rename + adjust |
| text | `#f5f5f7` | `--text #fafafa` | adjust |
| text-dim | `--text-muted #a1a1aa` | `--text-dim #a1a1aa` | rename |
| text-muted | `--text-dim #71717a` | `--text-muted #71717a` | rename |
| brand | `#1e90ff` | `#1e90ff` | match |
| brand-deep | `#0066d6` | `--brand-dim #0c5fb3` | rename + adjust |
| chrome | gradient `#2a2a30→#18181c` (dark!) | `--chrome-1 #e8e8ea` `--chrome-2 #a8a8ac` `--chrome-3 #5a5a5e` (LIGHT/silver) | **major fix** |
| radius | `0.625rem` | `10px` | match (~) |
| radius-lg | `0.875rem` | `14px` | match (~) |
| accent gold | none | `--accent-gold #d4a574` | add |

## Critical visual mismatches in current build

1. **Chrome buttons & logo are wrong color** — prototype chrome is **silver/light** (`#e8e8ea → #a8a8ac` with dark `#0a0a0b` text). Mine is dark gunmetal. The "B" logo, the active screen-tabs pill, and the "New Job" button when used as chrome are all light silver in the prototype.
2. **Logo wordmark is horizontal**, not stacked. "BuildScope" inline + "AI" via "Estimating OS for Contractors" subtitle below in `--text-muted`.
3. **Active nav uses `inset 2px 0 0`** (not `3px`) and gradient `rgba(30,144,255,.12) → rgba(30,144,255,.02)` (90deg, not 135).
4. **Stat cards use a linear gradient bg** `135deg, --bg-card, #161619` plus `::before` 80×80 radial glow positioned top-right (not full-card).
5. **Border colors are solid hex** (`#27272a`, `#3f3f46`), not rgba whites — this changes the entire perceived contrast.
6. **Primary button** is `linear-gradient(180deg, #2aa0ff, #1e90ff)` with `0 4px 14px rgba(30,144,255,.3)` glow — vertical, not 135deg.
7. **Dashboard greeting** — "Good afternoon, Jared" + a subtitle with stats summary, plus an Import + New Job button row (not just a one-line H1).
8. **Stat cards** show: Active Jobs, Sent This Month, Total Quoted ($847K), Avg Job Value — with `+/-` colored deltas (success/danger), not just label/value.
9. **Trade mix card** has heading "Trade Mix · Active Jobs" + subtitle "14 jobs total", segments labeled inline ("Roofing 5", "Interior 3", "Ext 2"…), then full legend below.
10. **Recent Jobs table columns**: Job #, Client, Property, Trade, Status, Total, Updated — I'm missing Client, Property, Updated.
11. **Sidebar nav grouping**: "Workspace" group (Dashboard / Jobs / Clients) + "Admin" group (Catalog / Price Books / Settings), with `.nav-label` section headers.
12. **Sidebar nav badges** — Jobs has a count badge (`14`).
13. **Topbar has a breadcrumb** ("Workspace / Dashboard"), a search box with ⌘K hint, and bell + New Job buttons.
14. **Onboarding** uses 28px round step indicators with check/active/idle states and Company step has Markup/Overhead/Profit % grid + License Numbers textarea.
15. **Login** has a 44px chrome mark + "BuildScope" name + tagline below ("Estimating OS for Contractors"), 24px headline, then Email/Password fields with brand focus ring.

## Plan — refit the foundation to match the prototype

### Step 1 — Replace `src/styles.css` CSS variable block
Adopt the prototype's exact tokens:
- Rename: `--surface → --bg-card`, `--surface-elevated → --bg-elevated`, `--surface-hover → --bg-hover`, `--text-muted → --text-dim`, `--text-dim → --text-muted`, `--border-strong → --border-bright`, `--brand-deep → --brand-dim`
- Add: `--chrome-1/2/3` (silver), `--accent-gold`, body radial-gradient backdrop, `--shadow-sm/--shadow/--shadow-lg`
- Switch borders from rgba-white to solid hex (`#27272a`, `#3f3f46`)
- Update `@theme inline` mappings + utility classes (`.btn-brand` → vertical gradient, `.btn-chrome` → silver, `.stat-glow` → linear bg + 80×80 ::before glow, `.nav-active` → `inset 2px 0 0` + 90deg gradient)

### Step 2 — Refit `<Logo>` component
Switch to silver chrome mark (`linear-gradient(145deg, #e8e8ea, #5a5a5e)` with dark text), inline "BuildScope" + "Estimating OS for Contractors" subtitle styling (matching `.logo-text .sub`).

### Step 3 — Refit `<AppSidebar>`
Add nav-label section headers ("Workspace", "Admin"), Jobs count badge, dark vertical gradient `#0d0d10 → #070708`, exact nav-item active gradient + 2px inset border.

### Step 4 — Refit `<Topbar>`
Add breadcrumb (Workspace / [current page]), search box with ⌘K kbd hint, bell icon button, primary "New Job" button (vertical brand gradient).

### Step 5 — Refit dashboard (`_app.index.tsx`)
- Replace H1+subtitle with the prototype's greeting card: "Good afternoon, [Name]" + subtitle line + Import (chrome) + New Job (primary) buttons on the right
- Stat cards: linear gradient bg + radial 80×80 ::before glow top-right, label/value/delta layout with success/danger colored delta
- Trade mix: header "Trade Mix · Active Jobs" + count, inline labeled segments + full 8-trade legend
- Recent Jobs table: add Client, Property, Updated columns

### Step 6 — Refit cards/badges
- `.card` styling: `var(--bg-card)`, `1px solid var(--border)`, 14px radius, 20px padding
- `<TradeBadge>` / `<StatusBadge>`: smaller padding (3px 8px), uppercase 11px font, .3px letter-spacing — match prototype `.badge`
- Add status badge variants for: lead, inspected, estimated, proposed, signed, in-progress, complete (already done; just verify colors match)

### Step 7 — Refit login + signup + onboarding
- Login card: 420px max-width, gradient bg `var(--bg-card) → #111114`, 20px radius, 40px padding, ::before subtle border-gradient overlay; 44px chrome mark + brand name + uppercase tagline
- Signup: same card style
- Onboarding: 28px circle step indicators (idle/active/done with check), 640px card, dark bg, with the same chrome step states from the prototype

### Step 8 — Verification (against prototype HTML)
Walk the user's checklist:
- [ ] Chrome silver "B" mark (light, not dark) + horizontal "BuildScope" wordmark
- [ ] `#0a0a0b` bg with subtle radial blue + gold glows
- [ ] Sidebar `linear-gradient(180deg, #0d0d10, #070708)`
- [ ] Active nav: `inset 2px 0 0` + 90deg `rgba(30,144,255,.12 → .02)`
- [ ] Stat cards: 80×80 radial glow top-right + linear gradient bg
- [ ] Trade mix horizontal stacked bar with 8 trade colors
- [ ] All numbers in JetBrains Mono
- [ ] Primary buttons: vertical gradient `#2aa0ff → #1e90ff` + brand glow
- [ ] Chrome buttons: silver `#e8e8ea → #a8a8ac` + dark text
- [ ] Tinted status/trade badges (uppercase 11px)
- [ ] Sidebar nav-label section headers + Jobs count badge
- [ ] Breadcrumb + ⌘K search in topbar

Then I'll ask you to compare side-by-side and call out any remaining diffs.

## Note
The pasted HTML was cut off in the middle of the recent-jobs table. The dashboard, login, onboarding, sidebar, topbar, and stats are fully captured — that covers all of Phase 1. For Measurements / Photos / Estimate / Report views I'll mirror the CSS classes that are in the prototype (already pasted) but the actual JSX for those views was deferred to the next prompt anyway, so no info loss.

Reply **approve** and I'll execute the refit.
