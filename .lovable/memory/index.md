# Memory: index.md
Updated: now

# Project Memory

## Core
Mapbox token served via global edge function (server route /api/mapbox-token using process.env.MAPBOX_API_TOKEN). Switch to per-company storage on the companies table before scaling past 10 active companies.
Design system: Archivo for UI, JetBrains Mono for numbers/codes. Trade colors from src/lib/trades.ts. Primary buttons = blue gradient, Chrome = metallic silver. Cards: var(--bg-card) bg, 1px var(--border), 14px radius.
Always use semantic CSS tokens from src/styles.css; never hardcode colors.
Use react-hook-form + zod for forms. sonner toasts for async actions. Skeletons for loading.
Lovable Cloud (Supabase) backend. RLS enforced via auth_company_id() and is_company_admin().
AI providers: Anthropic Claude (claude-sonnet-4-5-20250929) for roof condition/damage vision via direct ANTHROPIC_API_KEY. Gemini 2.5 Pro via Lovable AI Gateway (LOVABLE_API_KEY) for photo→line-item matching. Google Solar API uses GOOGLE_MAPS_API_KEY (Solar API enabled on same GCP project).
Storage: roof-photos bucket is private, keyed `{company_id}/{job_id}/{filename}`. RLS scopes by first folder = company_id.
