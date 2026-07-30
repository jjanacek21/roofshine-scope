## Goal

Replace today's 8 trades with the 15 categories you described, and re-sort every catalog item (and its sub-group) into the right home — so Interior stops holding garage doors, fencing, exterior paint, etc.

## New top-level categories

```text
ROOFING              everything on/of the roof (incl. skylights, solar, roof-top HVAC curbs, roof flashing)
ELEVATIONS           siding, soffit, fascia, gutters, window wraps, stucco, fiber cement, house wrap, masonry veneer
EXTERIOR             fences, gates, exterior cleaning, pressure washing, decks, exterior structures
CONCRETE / ASPHALT   flatwork, driveways, sidewalks, patios, pavers, asphalt, curbing
PAINTING             prep, interior + exterior paint, staining (deck/fence/cabinets), epoxy floors & counters
INTERIOR             drywall, cabinets, trim, flooring, countertops, fixtures, interior cleaning, contents
WINDOWS / DOORS      garage doors, wood/aluminum/vinyl windows, interior & exterior doors, hardware, glazing, blinds
PLUMBING             own category
ELECTRICAL           own category
HVAC                 own category
WATER / MOLD MITIGATION  own category
EQUIPMENT            rentals, lifts, scaffolding, machines
LABOR                trade labor minimums, hourly contractors, time-based charges
DEMO                 demolition, debris, dumpsters, haul-off, interior/exterior cleaning tied to demo
MISC ITEMS           detach/reset structures, appliances, pool & screen enclosures, awnings, storm shutters
TREE REMOVAL / LANDSCAPING  trees, landscaping, sod, sprinklers, irrigation
```

## Work to do

**1. Extend the trade enum + app trade list**
Add the 7 new values (`elevations`, `concrete_asphalt`, `painting`, `equipment`, `labor`, `demo`, `misc`, `landscaping`) to the `trade_type` enum via migration; keep the existing 8 values so nothing referencing them breaks. Update `src/lib/trades.ts` with the full ordered list, labels, colors and icons — that single file drives the catalog tree, master catalog, estimate picker, job trade picker, photo filters, macros and the trade-mix bar.

**2. Reclassify the catalog (data migration on `line_item_master`)**
Rules applied in priority order, using Xactimate code prefix first, then item-name keywords:

- Move all `DOR*` (garage/overhead, interior, exterior doors, hardware) out of Interior into WINDOWS/DOORS, alongside existing window sub-groups.
- Move `FNC*`, `DEK*`, exterior structures, pressure washing/exterior cleaning into EXTERIOR.
- Move `CON*` flatwork, asphalt, pavers, curbing into CONCRETE/ASPHALT.
- Move all `PNT*`, staining, epoxy, and prep items — interior and exterior — into PAINTING.
- Move siding/soffit/fascia/gutter/stucco/fiber-cement/masonry/house-wrap out of today's Exterior into ELEVATIONS.
- Move roof-mounted items (skylights `WDSD*`, solar, roof curbs, chimney/roof flashing, roof jacks) into ROOFING regardless of their original code family.
- Move `LND*`/tree/sod/irrigation/sprinkler items into TREE REMOVAL / LANDSCAPING.
- Move `EQP*`/rental/lift/scaffold items into EQUIPMENT.
- Move every hourly/labor-minimum/"…Laborer"/"…Technician" row from every trade into LABOR (roofing labor adders that price roof work stay in ROOFING).
- Move `DMO*`, dumpsters, haul & dispose, debris into DEMO.
- Move appliances, awnings, storm shutters, pool/screen enclosures, detach & reset structures into MISC ITEMS.
- Plumbing, Electrical, HVAC, Mitigation keep their items; only stray rows get pulled in/out.

**3. Re-cut sub-groups**
Each new category gets a clean sub-group set (e.g. WINDOWS/DOORS → Garage & Overhead Doors, Exterior Doors, Interior Doors, Door Hardware, Aluminum/Vinyl/Wood Windows by type, Glazing & Repair, Blinds & Shades, Screens; DEMO → Interior Cleaning, Exterior Cleaning, Dumpsters & Haul-Off, Demolition Labor; LABOR → per-trade minimums, hourly rates). Existing good sub-group names are reused so items merge rather than duplicate.

**4. Verify**
Query counts per category/sub-group after the migration, confirm no "Other" bucket over a small residual, and spot-check the estimate line-item picker and Master Catalog browser render the 15 categories with sensible groupings.

## Technical notes

- Two migrations: (a) enum extension (enum values must be committed before use, so this runs separately), (b) the bulk `UPDATE` on `line_item_master` where `company_id is null`.
- `line_item_prices` is untouched — market pricing is unaffected.
- Existing jobs/photos keep their current trade values; they remain valid enum members.
- Only `src/lib/trades.ts` changes in the frontend; all consumers read from it.
