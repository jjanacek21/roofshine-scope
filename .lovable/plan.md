# Fix: contract iframe blocked inside Lovable preview

## What's actually wrong

The iframe is showing the browser's broken-document icon because the signing
HTML never reaches it. I confirmed with curl:

- `https://id-preview--{id}.lovable.app/api/public/sign` → **302** to
  `lovable.dev/auth-bridge` (the auth-bridge then refuses to be framed →
  blank icon)
- `https://project--{id}-dev.lovable.app/api/public/sign` → **200** with the
  signing HTML

In other words, the `id-preview--*` host (which is what the editor iframe
uses) auth-gates **every** request — including paths under `/api/public/*`,
contrary to what I assumed last round. Opening in a new tab works only
because the auth-bridge can complete its cookie round-trip at top-level;
inside an iframe third-party cookies are blocked, so it never resolves.

The stable `project--{id}-dev.lovable.app` host serves the same build but
without the preview auth gate, so it can be safely framed.

## Fix

One-line conceptual change: when no tenant override is set, build the signing
URL against the stable preview host instead of a relative path.

### Code changes

1. **`src/lib/contract-config.ts`** — make `buildSigningUrl` produce an
   absolute URL by default:

   - Read `VITE_SUPABASE_PROJECT_ID` (already in `.env`) — but that's the
     Supabase ref, not the Lovable project id. Instead hardcode the Lovable
     project id we already know (`2bd97912-9ef6-411c-8da4-d86ee5db73a0`) into
     a single constant `LOVABLE_PROJECT_ID`. It's a public identifier; safe
     to ship.
   - Default `SIGN_BASE_URL` becomes
     `https://project--${LOVABLE_PROJECT_ID}-dev.lovable.app/api/public/sign`.
   - Tenant override (`tenants.sign_base_url`) still wins when set.

   Why hardcode and not detect from `window.location.host`? Because the
   editor iframe runs at `id-preview--*.lovable.app`, so detecting from the
   host would just reproduce the bug. The stable URL is the whole point.

2. **No other file changes needed.** The route at
   `src/routes/api/public/sign.ts` already serves the HTML correctly with
   `x-frame-options: SAMEORIGIN` (same-origin is fine because the parent
   page is the same `project--*-dev.lovable.app` build).

### Verification I'll run after the change

- Hit `/jobs/.../contract`, pick Construction Agreement, confirm Step 1 of 5
  renders inside the iframe.
- Walk the 5-step flow (customer info → trades → review → signature →
  filed) and note any UI/validation issues for follow-up.
- Use the browser tool screenshot to confirm visually.

## Follow-ups (not part of this fix)

- Once the project is published, also try `project--{id}.lovable.app` (no
  `-dev`) so signed contracts use production. That URL currently 404s
  because nothing is published yet.
- Longer term, consider serving the signing HTML from a fully separate
  static host so it isn't tied to Lovable's preview proxy at all.
