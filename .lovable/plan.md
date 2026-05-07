# Fix: invite emails routing to Lovable login

## Root cause

`src/routes/_app.team.invites.tsx` builds invite links with:

```ts
const inviteLink = (token) => `${window.location.origin}/onboarding?invite=${token}`;
```

When you send an invite from inside the Lovable editor, `window.location.origin` is the **preview URL** (`id-preview--...lovable.app`). Those preview URLs are gated by Lovable workspace auth, so the invitee is prompted to "create a Lovable account" before they ever reach your app's `/onboarding` page.

The same problem affects the `send-invite-email` edge function — it just forwards whatever `inviteUrl` the client sent.

## Fix

Always build invite links against the production app URL (`https://globalcontractor.app`), regardless of where the admin is when sending.

### Changes

1. **`src/lib/app-url.ts`** (new tiny helper)
   - Export `APP_URL = "https://globalcontractor.app"` as the canonical public origin.
   - Single source of truth so we can swap domains later.

2. **`src/routes/_app.team.invites.tsx`**
   - Replace `window.location.origin` in `inviteLink()` with `APP_URL`.
   - Both the "Copy link" button and the email payload then use the production URL.

3. **`supabase/functions/send-invite-email/index.ts`** (defense in depth)
   - If the incoming `inviteUrl` doesn't start with `https://globalcontractor.app`, rewrite it to that origin while keeping the path + query (`/onboarding?invite=...`).
   - Guarantees emails always link to the public app even if an old client sends a preview URL.

### Out of scope

- No DB / RLS changes.
- No change to the `/onboarding` accept flow itself — it already works once the user lands on the production URL.
- Not touching auth providers; users still create an account in **your** app (email/password or Google), not a Lovable account.

## After implementing

Send a fresh test invite to yourself, open the email on a device where you're not logged into Lovable, and confirm the link goes straight to `globalcontractor.app/onboarding?invite=...` and shows your signup screen.
