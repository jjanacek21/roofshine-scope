# Storm Intelligence page

Add a new authenticated page at `/storm-intelligence` that renders a Mapbox map showing NOAA hail swaths (gradient bands) and NWS wind gust reports / warning polygons, driven by the four existing Supabase RPCs.

## New files

**`src/components/storm/StormSwathMap.tsx`**
- Props: `eventDate: string | null`, `windHours: number` (default 72), `center: [lng, lat]`, `zoom: number`
- Uses `useMapboxToken()` (reuses `/api/mapbox-token`) — no new env var
- Initializes `mapbox-gl` map with dark style, adds nav + scale controls
- On load / prop change, calls:
  - `supabase.rpc("swath_geojson", { p_event_date, p_product: "MESH_Max_1440min" })` → hail source
  - `supabase.rpc("wind_geojson", { p_hours: windHours })` → wind source (points + polygons in one FC)
  - `supabase.rpc("territories_geojson")` → territory outlines source
- Layers (bottom → top):
  1. `territories-line` — thin white outline
  2. `hail-fill` (fill) using `["get", "color"]` from feature props; opacity 0.55
  3. `hail-outline` (line) subtle stroke
  4. `wind-warning-fill` filtered to Polygon/MultiPolygon geometry, red tint, low opacity, dashed outline — **never a smooth gradient**
  5. `wind-gust-points` filtered to Point geometry, circle radius scaled by `gust_mph` prop, orange
- Popups: click hail feature → shows `band`, `min_in`–`max_in` inches; click wind → shows `gust_mph`, `report_time`, `source`
- Legend overlay (bottom-left): hail gradient swatches (yellow #FFD400 → orange → red → purple #7B1FA2) with inch ranges + wind marker key labeled "Gust reports & warning areas"
- Handles empty FeatureCollections gracefully (empty state note in legend when no hail features for the date)
- Cleanup: remove map on unmount

**`src/routes/_app.storm-intelligence.tsx`**
- Route: `createFileRoute("/_app/storm-intelligence")`
- Head metadata: title "Storm Intelligence", description
- Layout: full-height container (`h-[calc(100vh-var(--topbar-h))]`) with a top toolbar and the map filling the rest
- Toolbar controls:
  - **Date dropdown** (shadcn `Select`) — options fetched via `useQuery(['swath-dates'], () => supabase.rpc('swath_dates'))`; default = most recent date; "No swaths available" empty state
  - **Market toggle** (shadcn `ToggleGroup`) — DFW `[-96.8, 32.78]` / South Florida `[-80.35, 26.1]`; changing it flies the map via a ref-forwarded `flyTo` (or key-based remount if simpler)
  - **Wind window** (shadcn `Select`) — 24h / 48h / 72h (default 72)
- Renders `<StormSwathMap eventDate={date} windHours={hours} center={center} zoom={9} />`

## Modified files

**`src/components/layout/AppSidebar.tsx`**
- Add new sidebar item "Storm Intel" with a `CloudLightning` (lucide) icon, linking to `/storm-intelligence`, placed in the main nav group

**`src/components/layout/MobileBottomTabs.tsx`** (only if it lists top-level pages)
- Add the same entry if it fits the existing pattern; skip otherwise

**`package.json`**
- `bun add mapbox-gl @types/mapbox-gl`

## Technical notes

- **No backend work**: the four RPCs (`swath_geojson`, `wind_geojson`, `territories_geojson`, `swath_dates`) and their tables are assumed to already exist and be anon-readable per the spec. If any RPC returns a permission error at runtime, that's a Supabase-side issue outside this plan's scope.
- **Mapbox token**: served by the existing `/api/mapbox-token` server route via `useMapboxToken()`. No `VITE_MAPBOX_TOKEN` added — matches the current project convention noted in memory.
- **Wind rendering rule**: wind data renders only as (a) circle points sized by gust, (b) polygon fills for warning areas with a distinct dashed outline. No heatmap, no interpolated gradient — labeled explicitly "Gust reports & warning areas" in the legend and popups.
- **Hail color source of truth**: features carry their own `color` prop; layers use `["get", "color"]` so the frontend adds no color logic.
- **Data fetching**: React Query with `staleTime: 5 * 60 * 1000` for swaths (per date) and `60 * 1000` for wind. Query keys include `eventDate` / `windHours` so switching refetches.
- **Empty states**: if `swath_dates` returns `[]`, the date select shows a disabled "No hail data yet" option and the hail layers stay empty; wind layers still render.
