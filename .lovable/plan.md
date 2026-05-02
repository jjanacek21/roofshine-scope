# Lead Center Overhaul — Theme, Dashboard, Lead Detail, AI Wizard, Savings, Import, and Full Training + Floating Call Playbook

This is a large multi-area refresh based on the two prompts. Map view, map tiles, and map interactions are explicitly **not touched**.

## Important preference call-out

Prompt 1 specifies hex colors and Tailwind classes like `bg-slate-800`, `text-green-400`, `#0f172a`. Project memory says **never hardcode colors — always use semantic tokens from `src/styles.css`**. I'm going to honor the memory: I'll re-tune the existing tokens (`--bg-page`, `--bg-card`, `--border`, `--primary`, `--text-dim`, status colors, etc.) to match the values in prompt 1, then use those tokens everywhere. Visually it lands on the same dark/green look without scattering raw hex around. Status badges and chart accents will get matching token aliases (`--status-new`, `--status-contacted`, etc.).

If you'd rather hardcode `slate-800`/`green-400` directly in JSX, say so and I'll switch. Otherwise the rest of the plan assumes tokens.

## 1. Theme + chrome (prompt 1 §1)

- **`src/styles.css`**: retune the dark palette so `--bg-page = #0f172a`, `--bg-card = #1e293b`, `--border = #334155`, `--primary = #22c55e` (+ glow + muted), text scale matches `#e2e8f0 / #94a3b8 / #64748b`. Add `--status-{new,contacted,qualified,quoted,won,lost,dnc,report_sent}` tokens at full color, plus `/20` variants for badge backgrounds. Custom thin scrollbar (6px, `--border` track, slate-500 thumb). Set Inter as the body font (Archivo is currently in Core memory; I'll **propose** swapping body to Inter — confirm before I update memory).
- **`AppSidebar`**: 256px fixed, dark, right border. Logo = green rounded square + "GCN Lead Center" / "Commercial Roofing". Active link = `bg-card` + `text-primary`. Section dividers with uppercase `tracking-wider` labels ("Tools", "Settings"). User chip at bottom (already exists in collapsed/expanded states from prior work — this just restyles it).
- **App header** (`src/routes/_app.tsx`): h-16, dark bg, bottom border. Left: page title + green pill lead-count badge (counts pulled from `useLeads`). Right: search input (used as a global lead search) + green "Import Leads" button.
- **Cards**: refactor existing `.card` utility class so all cards inherit `bg-card` / 1px `--border` / `rounded-xl` / `p-5`. No shadows, no gradients.
- **Modals**: Dialog + Sheet primitives get the new overlay (rgba(0,0,0,.7) + 4px blur) and `bg-card` / `rounded-2xl`.

## 2. Dashboard view (prompt 1 §2)

Replace the placeholder content on `_app.leads.index.tsx` (the lead center landing) with:

- **Row 1 — 4 KPI cards** (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`): Total Leads / Contacted (+ contact-rate %) / Qualified (+ qual-rate %) / Won (+ pipeline $). Each: colored icon disc (`bg-{status}/20` token) + big number + subtitle.
- **Row 2 — 2 charts** using `recharts` (already in project — verify): Lead Pipeline (horizontal bar, one bar per status, color-coded by status token) + Monthly Imports (vertical bar, last 12 months, grouping by `import_date` truncated to month).
- **Row 3 — Recent Leads table**: 10 most recent. Columns Property / Owner / Roof Type / Sq Ft / Status badge / Actions (Call, Email, AI). Empty state: upload icon + "No leads yet" + "Import a Reonomy CSV to get started" + CTA.

## 3. Lead detail panel (prompt 1 §3)

Rebuild `LeadDetailSheet.tsx` (existing) into the slide-in spec:

1. **Property Info** card — grid of Address / City-State-Zip / Owner / Type / Sq Ft / Year Built / Roof Type.
2. **Contacts (N)** — for each contact in `lead_contacts`: bold name + muted title, optional company, phones as **green pill `<a href="tel:">`** badges, emails as **blue pill `<a href="mailto:">`** badges. Divider between contacts. "No contact info" muted fallback.
3. **Satellite preview** — 192px tall. If `GOOGLE_MAPS_API_KEY` server secret is present, fetch a Static Maps satellite image at zoom 19 via a small new server function `getStaticMapUrl({ leadId })` (keeps the key server-side). Otherwise show "Add Google Maps API key in Settings". (`MAPBOX_API_TOKEN` is already wired — fallback to a Mapbox satellite static image if Google key isn't set, since we already proxy Mapbox.)
4. **Quick Actions** — 3 buttons: Call (green), Email (blue), Text (purple). Call also opens the **Floating Call Playbook** with the lead context (see §8).
5. **Add Note** — textarea + Save → `lead_notes` insert + `lead_activities` log entry.
6. **Activity Log** — reverse-chrono from `lead_activities`, icon per type + note + relative timestamp.

## 4. AI Roof Wizard improvements (prompt 1 §4)

Map and pin interaction: untouched.

- **Measurement results panel** rebuild: per-pin section showing pin number, total roof sqft (large, comma-formatted), segment count, avg pitch (°), annual sun hours, and a segments table (Segment / Area / Pitch / Azimuth) sourced from `roofSegmentStats`. If multi-pin: a Combined Totals card.
- **AI analysis prompt**: replace the current Claude Vision prompt in `src/server/lead-ai.functions.ts` (`analyzeRoofWithAI`) with the exact 6-section prompt in §4. Keep the existing image-attachment flow.
- **AI report card**: green left-border, parse the response into 6 collapsible accordions (Roof Type / Condition / Visible Issues / Penetrations / Recommendations / SPF Candidacy). Condition scores rendered as colored chips (red 1–3 / amber 4–6 / green 7–10). Action row: "Save to Lead" (writes to `leads.ai_report`), "Export PDF" (uses existing `pdf-generator.ts`), "Back to Map".

## 5. Savings calculator pricing (prompt 1 §5)

In `_app.leads.savings.tsx`:

- Replace cost tables with the exact `tearoffCosts` and `spfCosts` maps.
- Layout: side-by-side red Replacement card vs. green SPF card → big centered savings highlight → 20-year breakdown (energy, maintenance, 179D tax incentive) → ROI row (Payback, Energy Reduction 20–30%, ROI 2–3x) → "Why Spray Foam?" checkmark list.

## 6. CSV import (prompt 1 §6)

Already supports drag-and-drop and most fields. Audit `_app.leads.import.tsx` + `src/server/leads.functions.ts` parser and:

- Confirm `ondragover` / `ondragleave` / `ondrop` highlight the dropzone with `--primary` border.
- Add/verify column aliases: `street`, `address_full`, `gross_building_area`, `reported_owner`, `contact_1_name`…`contact_3_emails`, `contact_name`, `contact_phone_1`, `contact_email_1`.
- Pipe-split phones/emails on `|` into separate rows in `lead_contact_phones` / `lead_contact_emails`. Existing dedupe logic from the prior change keeps duplicates in check.

## 7. Training Center rebuild (prompt 2)

Replace `src/lib/playbook.ts` and `_app.leads.training.tsx`:

- **`src/lib/playbook.ts`**: new schema:
  ```ts
  export interface PlaybookSection { id: string; title: string; body: string; } // body is HTML/whitespace-pre-line
  export interface PlaybookCategory {
    id: string; title: string; emoji: string; color: "blue"|"green"|"red"|"purple"|"cyan"|"amber"|"indigo"|"pink"|"yellow";
    sections: PlaybookSection[];
  }
  export const PLAYBOOK: PlaybookCategory[] = [/* all 9 categories from prompt 2 */];
  ```
  All section content is copy-pasted **verbatim** from prompt 2 (philosophy, masterScript, rebuttals, productTalk, roofTypes, icebreakers, scenarios, tonality, quickRef — note: prompt also includes a 10th `training` category which I'll include for completeness).
- **Training Center** (modal route or in-page panel — current is a route at `/_app/leads/training`; I'll keep the route and render the modal-style two-column layout inside it):
  - Left sidebar w-56, dark bg, 9 category buttons (emoji + title + green dot if in My Playbook).
  - Right scrollable content: category emoji + title + "✓ In My Playbook" / "+ Add to Playbook" toggle. Sections rendered as accordion cards (`bg-card`, `border`, `rounded-xl`), all expanded by default when category switches. Body uses `whitespace-pre-line` and supports `**bold**` / `*em*` / line breaks via a tiny markdown renderer (no extra deps).
- **My Playbook persistence**: `playbook_preferences` table already exists with `selected_sections` array column. Hook `useMyPlaybook()` returns `{ ids, toggle(id) }` and writes upserts. Default seed: `['quickRef', 'rebuttals', 'masterScript']` (already in DB default).

## 8. Floating Call Playbook (prompt 2)

Rebuild `src/components/leads/CallPlaybookPanel.tsx`:

- Mounted once at app shell level (in `_app.tsx` layout) so it survives navigation.
- Global Zustand store (`src/hooks/useCallPlaybook.ts`): `{ open, leadContext, openWith(lead), close() }`.
- Position: `fixed`, default `right: 24px; top: 80px`, width 384px, `max-h-[70vh]`, `bg-card` `rounded-2xl` `border` `shadow-2xl`, z-50.
- **Sticky header**: "📞 Call Playbook" + close X. Header has `cursor: move` + mousedown/move/up handlers that update an internal `{x,y}` state — pure vanilla, no library.
- **Lead context card** (when opened from a lead): owner / address+city / "{sqft} sqft • {roof_type} • Built {year_built}".
- **Body**: for each id in user's `selected_sections`, render the matching `PlaybookCategory` with emoji + title (color from token map) + each `PlaybookSection` as a collapsed mini-accordion (text-xs, dense). Click to expand individual sections.
- **Empty state**: "No sections selected — Go to Training Center to add sections to your playbook" with a Link button.
- **Call action wiring**: in `LeadDetailSheet` Call button + leads-list inline Call action → `useCallPlaybook().openWith(lead)` AND `window.location.href = "tel:..."`.
- Panel does NOT block clicks on the rest of the app (it's a positioned `div`, not a modal overlay).

## 9. Memory updates (after approval)

- Note: theme tokens were retuned; status color tokens added.
- If you confirm the Inter switch, update memory's font note from "Archivo for UI" → "Inter for UI". Otherwise keep Archivo and just apply prompt 1's other rules.
- Floating Call Playbook is the canonical component; never rebuild it inline per route.

## Out of scope (will not touch)

- `_app.leads.map.tsx`, the Mapbox map setup in the wizard, mapbox-draw, satellite tile sources.
- Existing import dedupe semantics (kept).
- Auth / RLS / migrations — no DB schema changes needed; `playbook_preferences` already has the right shape, `lead_activities` and `lead_notes` already exist.

## Delivery order (what I'll ship)

To keep this reviewable, I'll do it in 3 commits in one turn:

1. **Theme + chrome** (styles.css, sidebar, header, card/dialog tokens) — fastest visible change.
2. **Lead center pages** — dashboard, lead detail, savings pricing, AI wizard report, CSV column aliases.
3. **Training Center + Floating Call Playbook** with full playbook content.

Reply "go" and I'll start. If anything in §1 (token-vs-hardcoded, Inter-vs-Archivo) needs to change first, tell me before I start.
