

## Diagnosis

Two distinct bugs:

### Bug 1 — Email link sends users to a Lovable login page
The Supabase project has the managed Lovable email hook turned ON, but no custom auth templates have been scaffolded in this codebase. Result: Supabase uses Lovable's default-branded recovery email, whose link goes through `api.lovable.dev/.../email-hook` and lands on a Lovable account screen before forwarding to your app. End users (your contractors) don't have Lovable accounts, so they're stuck.

### Bug 2 — `/reset-password` page sometimes fails to accept a new password
The page only sets `ready = true` on `PASSWORD_RECOVERY` / `SIGNED_IN` events. But Supabase's `detectSessionInUrl` (default ON) may have already consumed the URL hash and established the session before our `onAuthStateChange` listener mounted. We DO have a `getSession()` fallback, but it doesn't tell us "this is a recovery flow," so when no session is found we just sit on "Verifying…" forever. We also need to handle the `?error=...` querystring Supabase appends when a link is expired/invalid.

## Plan

### 1. Scaffold custom Lovable Auth Email templates (fixes Bug 1)
Use the project's existing email infrastructure to generate branded auth email templates. The scaffolded "recovery" template will send users straight to **your** app's `/reset-password` page with the recovery tokens — no Lovable login screen in the middle.

Steps the agent will run in default mode:
- Check current email-domain status. The project already has `LOVABLE_API_KEY` and the email hook is firing, so a domain is wired up.
- Scaffold the 6 Lovable auth email templates (recovery, magic link, signup confirmation, email change, invite, reauthentication). The recovery template's CTA links directly to `https://<your-app>/reset-password#access_token=…&type=recovery`.
- Apply the project's brand styling (dark UI, Archivo font, brand blue) to the templates, with white email body background per email standards.

### 2. Harden `/reset-password` page (fixes Bug 2)
Rewrite the page so it works regardless of timing:
- On mount, parse both the URL **hash** (`#access_token=…&type=recovery`) AND **query string** (`?error=…&error_description=…`).
- If the hash contains a recovery token, call `supabase.auth.setSession({ access_token, refresh_token })` explicitly so we don't depend on the auto-detector's race.
- If the URL contains an error param (link expired, already used), show a clear message + a "Request a new link" button → `/forgot-password`.
- Mark `ready = true` as soon as either (a) we successfully set the session, or (b) `getSession()` returns an existing session.
- After successful `updateUser({ password })`, sign out and redirect to `/login` (already correct).

### 3. Harden `/forgot-password` redirect URL
Currently uses `window.location.origin`. In production behind the published domain that's fine, but in the lovableproject preview the recovery email may redirect to a stale origin. Keep `window.location.origin` (correct) and add a small note for the user to always click the link in the SAME browser they requested it from (Supabase recovery tokens are tied to the browser session that requested them).

### Files
- New: 6 auth email template files + `auth-email-hook` server route (created by scaffold tool)
- Edit: `src/routes/reset-password.tsx` (robust token handling)
- No changes needed to `forgot-password.tsx` or `login.tsx`

### What you'll see after this ships
1. Click "Forgot password" → enter email → receive a branded email from your domain
2. Click the email link → land directly on **your** `/reset-password` page (no Lovable login)
3. Type new password + confirm → success → redirected to `/login`

