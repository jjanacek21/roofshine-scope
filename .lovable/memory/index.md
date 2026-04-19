# Memory: index.md
Updated: now

# Project Memory

## Core
Mapbox token served via global edge function (server route /api/mapbox-token using process.env.MAPBOX_API_TOKEN). Switch to per-company storage on the companies table before scaling past 10 active companies.
Design system: Archivo for UI, JetBrains Mono for numbers/codes. Trade colors from src/lib/trades.ts. Primary buttons = blue gradient, Chrome = metallic silver. Cards: var(--bg-card) bg, 1px var(--border), 14px radius.
Always use semantic CSS tokens from src/styles.css; never hardcode colors.
Use react-hook-form + zod for forms. sonner toasts for async actions. Skeletons for loading.
Lovable Cloud (Supabase) backend. RLS enforced via auth_company_id() and is_company_admin().
Price books: super-admin uploads global "default" books (company_id=null, is_default=true, pricing_type='default') visible to everyone. Companies add their own with pricing_type='insurance' or 'retail'. Job price-book resolution: prefer company match by zip+type, fallback to default global.
Roof measurements: 5 input methods — manual numeric form, Mapbox polygon draw, Google Solar API auto, third-party report PDF (EagleView/Hover), photo AI. One roof_measurements row per property; multiple roof_sections (polygons with pitch); roof_edges label each polygon edge (eave/rake/hip/ridge/valley/gutter/wall_flashing/step_flashing/transition); roof_lines for free-floating labeled lines. Pitch multiplier: actual_area = plan_area × √(1+(rise/run)²). Waste options 10/15/20%.
