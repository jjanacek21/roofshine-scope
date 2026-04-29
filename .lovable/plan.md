## What's broken

The Contract page iframe points at `https://sign.globalcontractor.network/GCN-Sign.html`, which doesn't currently resolve. That's why you see the grey "broken document" placeholder — the iframe loaded nothing.

## Plan

### 1. Self-host the signer inside this app
- You'll upload `GCN-Sign.html` (and any companion JS/CSS/images) — I'll place them under `public/sign/` so they're served from the same origin as the app (e.g. `https://globalcontractor.app/sign/GCN-Sign.html`). No CORS, no X-Frame-Options issues, no third-party domain.
- Default `SIGN_BASE_URL` in `src/lib/contract-config.ts` switches from `https://sign.globalcontractor.network` to `/sign` (relative, so it works in preview, custom domain, and white-label domains automatically).

### 2. Add per-tenant signer URL override
Schema change on `tenants`:
- Add `sign_base_url text` (nullable). When set, used instead of the global default. When null, falls back to `/sign` (or whatever the global default is).

Code changes:
- Extend the `Tenant` type in `src/hooks/useTenant.tsx` with `sign_base_url`.
- `buildSigningUrl()` in `src/lib/contract-config.ts` accepts an optional `baseUrl` argument; the route `_app.jobs.$id.contract.tsx` passes `tenant.sign_base_url ?? SIGN_BASE_URL`.
- Admin page `src/routes/admin.tenants.tsx`: add a "Signing app URL" field to the tenant edit dialog (placeholder shows the default, leave blank to use it).

### 3. Better empty / error states on the Contract page
While we're in there:
- If the iframe fails to load (timeout ~5s), show a friendly fallback card with: "Couldn't load the signing app at `<url>` — check the URL in Admin → Contracts" and a Retry button. Better than a silent grey box.
- Add a small "Open in new tab" link next to "Save signed contract" so reps can pop the signer out if the iframe misbehaves on a specific iPad.

## Build order

1. DB migration: add `tenants.sign_base_url`.
2. Update `useTenant`, `contract-config.ts`, `_app.jobs.$id.contract.tsx`, and the admin tenant dialog.
3. Add iframe load-error fallback + "Open in new tab" link.
4. Wait for you to upload `GCN-Sign.html` → I drop it into `public/sign/`.
5. You reload the Contract tab — it loads from `/sign/GCN-Sign.html` on the same origin.

## What I need from you next turn

Just upload `GCN-Sign.html` (and any sibling assets it uses — images, CSS, JS). Drag-and-drop into chat is fine. After approval, I'll do steps 1–3 immediately so the plumbing is ready when the file lands.
