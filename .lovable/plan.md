## What's happening

The catalog tree groups items by their `subgroup` field and dumps anything blank into "Other". Right now most of the catalog has no subgroup at all, which is why "Other" is huge:

- Interior: 4,173 items with no subgroup
- Windows: 904
- Exterior: 318
- Roofing: 268 (this is why RFG240 3-tab, RFG300 laminated, roofers, membrane installers all sit in "Other" instead of Asphalt Shingles / Labor / Single-Ply)

Only a few thousand items got subgroups during earlier imports; the big master upload came in unclassified.

## The fix

The item codes are standard Xactimate category codes and are extremely reliable for classification (verified against the data):

```text
RFG240 / RFG300 / RFG400        -> Asphalt Shingles
RFGTILE / RFGSTIL / RFGSTL      -> Tile Roofing / Stone-Coated Steel
RFGVENT* / RFGVFGN              -> Ventilation
RFGPFLASH / RFGRUBPJ / RFGSPLYPJ-> Flashings
RFGSPLY / RFGRUB / RFGADHV      -> Single-Ply Membrane
RFGSHAKE*                       -> Wood Shakes/Shingles
RFGSLATE                        -> Natural Slate
RFGFLT                          -> Underlayments
0RFG / RFG-M (hourly labor)     -> Labor
WDA* / WDV* / WDW*              -> Aluminum / Vinyl / Wood Windows (by type: single hung, double hung, casement, slider, picture, awning)
WDTBL* / WDTH*                  -> Window Treatments (blinds, drapery)
WDSD*                           -> Skylights
DOROH* / DORS* / DORR*          -> Garage & Overhead Doors
DORX* / DORI*                   -> Exterior / Interior Doors
PLM*                            -> Plumbing sub-groups (copper, PEX, fixtures, tubs)
ELE* / LIT*                     -> Electrical / Lighting
PNT* / DRY* / FCC* / CAB* ...   -> Interior sub-groups
```

Work to do:

1. Build a complete prefix -> sub-group mapping for every code prefix that currently has a blank sub-group, across all trades (roofing, exterior, windows, interior, HVAC, plumbing, electrical, mitigation). Reuse the sub-group names that already exist (e.g. "Asphalt Shingles", "Ventilation", "Flashings") so items merge into the existing groups rather than creating near-duplicates.
2. For prefixes the mapping doesn't cover, fall back to name-keyword rules (e.g. names containing "shingle", "vent", "flashing", "drywall", "paint", "cabinet", "tub").
3. Create any genuinely new sub-groups needed (e.g. "Garage & Overhead Doors", "Skylights", "Window Treatments", "Copper Pipe", "Light Fixtures").
4. Apply it as a single database data-update over `line_item_master` where `company_id is null`, then verify no trade has more than a small residual "Other" bucket.
5. Sanity-check the estimate line-item picker and the Master Catalog browser render the new groups correctly.

Nothing in the app UI needs to change — the tree already reads `subgroup`.

## Separate issue I noticed

Every item currently appears **twice** in the picker (see your screenshots: two "Roofer", two "RFG240", two "RFG300"). That's duplicate rows in `line_item_master` from the master import, not a grouping bug. Say the word and I'll dedupe those in the same pass (keeping the row that carries market prices); otherwise I'll leave the data untouched and only fix sub-groups.

## Technical notes

- Pure data migration on `line_item_master.subgroup`; no schema change.
- Rules applied in priority order (exact prefix -> prefix family -> keyword -> leave as Other).
- `line_item_prices` is untouched, so market pricing is unaffected.
