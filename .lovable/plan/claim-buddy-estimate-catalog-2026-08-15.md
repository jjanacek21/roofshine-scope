# Claim Buddy Estimate Catalog

Make the Claim Buddy estimate come entirely from data you control in the Global Contractor admin portal, instead of the hardcoded roof-system logic that lives in code today (`src/lib/cbRoofSystems.ts` currently hardcodes every assembly and matches items by name keywords — that is the real source of the tile-priced-as-shingle bug).

Additive only: a new "Claim Buddy" admin section. No existing Global Contractor screen, route or component is modified.

## What gets built

### 1. Catalog data model

New tables:

- `cb_catalog_versions` — every edit creates a new version (note, who, when).
- `cb_assemblies` — one base assembly per roof system (what every roof of that type gets regardless of what the rep checked).
- `cb_assembly_items` — the price book lines inside an assembly, each with a quantity rule and waste.
- `cb_item_mappings` — maps a checklist item (`cb_item_catalog`, 80 items today: 33 roof, 41 exterior, 6 interior) to one or more price book lines. `roof_system` NULL is the default for all systems; a row with a roof_system overrides the default for that system only.

Roof systems supported: 3-tab shingle, architectural shingle, concrete tile, clay tile, standing seam metal, exposed fastener metal, TPO, modified bitumen, SPF foam, coating restoration.

Quantity rules reuse the existing `qty_mode` concept from `master_macro_items` and `code_rule_items` — no second system. Modes: fixed count, per square (with waste), per LF of eave / rake / ridge / hip / valley / step flashing / wall flashing, per EA from the rep's count, per opening, per elevation, per room.

`code_rule_sets` / `code_rule_items` already exist (3 sets, 15 items) and are reused as-is, not duplicated.

`estimates` gets `catalog_version_id`.

### 2. Governance

- Every estimate stamps the catalog version that produced it.
- Mappings are deprecated (`is_active=false`), never deleted, so old estimates still resolve.
- Saving an edit writes a new version rather than mutating the old rows.
- A saved estimate never silently recalculates. Re-running against the current catalog is an explicit "Rebuild as v2" action.
- Global defaults with per-tenant override, same pattern as branding. Tenants read only, labelled "Managed by Global Contractor Network."

### 3. Admin screens — `/admin/claim-buddy`, super-admin only

Sidebar entry in the existing admin nav, gated by the existing `super_admin` role check on the `/admin` layout. A Claim Buddy standalone account has no path to it.

Tabs:

- **Roof takeoff / Exterior takeoff / Interior takeoff** — the real `cb_item_catalog` rows for that scope, grouped. Click an item to open a mapping panel: search `line_item_master` (10,048 rows) by code or name, showing code / name / unit / default price; assign several lines to one item; set a qty rule per line; add a per-roof-system override where the labor genuinely differs.
- **Assemblies** — one base assembly per roof system, edited the same way.
- **Code rules** — rule sets by state and county with the lines each injects. The Florida set is left empty; no invented code items or references.
- **Measurement accuracy** — see below.
- **Coverage indicator** on each takeoff tab: which catalog items have no mapping yet, per roof system, with a coverage percentage.

### 4. Measurement accuracy

Extend the existing `ai_measurement_runs` table (208 rows) — no second table. Added per run: raw geometry as returned, regularized geometry after the squaring pass, final rep-adjusted geometry, deltas (area %, perimeter %, per-vertex movement in feet), address, roof system, and whether the rep hard-overrode. The provider column already exists.

Ground truth is the rep's own correction. The tab reports average area delta by provider, by roof system, and whether regularization is reducing or increasing the correction reps have to make.

### 5. Rep side, in Claim Buddy

The estimate screen at Review & Present gains:

- a price book picker — search `line_item_master` by code or name, filtered to trade, showing code / name / unit
- inline quantity and price override on any line (already present)
- add, delete, reorder
- a source badge on every line: assembly, takeoff, photo analysis, code, or manual

No logo or color changes.

### 6. Estimate engine rewrite

`src/lib/cbEstimate.ts` stops calling the hardcoded `findAssembly()` keyword matcher and instead resolves: base assembly for the job's roof system → item mappings for everything the rep checked (system override beating default) → code rules last. A roof system with no assembly still fails loudly rather than falling back to shingle.

## Verification

Seed the architectural shingle and concrete tile assemblies with real mappings, build an estimate against a job whose takeoff says concrete tile, and paste back the resulting line items with their provenance — confirming zero shingle lines — plus the coverage percentage for each of the three takeoff sheets.

## Technical notes

- Migration order per new public table: CREATE TABLE, GRANT to `authenticated` / `service_role`, ENABLE RLS, CREATE POLICY. Catalog tables are readable by any authenticated user (tenants read the settings) and writable only by `super_admin`.
- Admin screens live in new route files `src/routes/admin.claim-buddy.*.tsx` plus a nav entry appended to the `NAV` array in `src/routes/admin.tsx` — the only touch to an existing GC file, and it is one array element.
- New libs: `src/lib/cbCatalogAdmin.ts` (version-aware reads/writes), `src/lib/cbResolveEstimate.ts` (assembly + mapping + code resolution). `cbRoofSystems.ts` is kept only as the seed source for the initial catalog version.
