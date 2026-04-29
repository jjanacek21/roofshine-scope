# Fix: "refused to connect" in the signing iframe

## Root cause

The iframe loads `/api/sign`, but the lovableproject.com preview proxy treats
**every** `/api/*` route as protected and responds with a `302` redirect to
`https://lovable.dev/auth-bridge`. The auth-bridge page sets `X-Frame-Options:
DENY`, so the browser blocks it inside the iframe → "refused to connect."

I confirmed this by hitting `/api/sign` and `/api/mapbox-token` with curl —
both 302 to auth-bridge regardless of cookies.

Per the project's server-route docs, routes under `/api/public/*` bypass the
preview auth gate. That's the correct home for an iframe endpoint.

## Changes

1. **Move route file**
   `src/routes/api.sign.ts` → `src/routes/api/public/sign.ts`
   - New URL: `/api/public/sign`
   - Update the relative `?raw` import path for the bundled HTML
     (`../../../sign/GCN-Sign.html?raw`)
   - Same body: streams the bundled signing HTML with
     `content-type: text/html` and `x-frame-options: SAMEORIGIN`

2. **Update `src/lib/contract-config.ts`**
   - `SIGN_BASE_URL = "/api/public/sign"` (was `/api/sign`)
   - `buildSigningUrl` already appends `?<query>` directly, no further change

3. **Verify in the browser**
   - Reload `/jobs/.../contract`, click Construction Agreement
   - Confirm Step 1 of 5 renders inside the iframe (no "refused to connect")
   - Walk through customer info → trade selection → review → signature →
     filed, flagging any UI/validation issues found

## Why not the other options

- Keep file in `public/`: TanStack Start's SSR catch-all returns the SPA
  shell for any non-bundled path on the Cloudflare Workers target — already
  proven by the original 404.
- Set CSP/X-Frame-Options on `/api/sign`: useless because the proxy
  intercepts before our handler runs and replaces the response with the
  auth-bridge redirect.
- Disable preview auth: not a per-route control we have.
