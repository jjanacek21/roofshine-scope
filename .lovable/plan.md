# Fix: Invite token lost when joining from email link

## The bug

When a user clicks the invite link in their email (`/onboarding?invite=TOKEN`):

1. They're not authenticated → `onboarding.tsx` redirects them to `/login`, **dropping the `?invite=` param**.
2. After login, they land on `/` which checks for a company → finds none → redirects back to `/onboarding` **with no invite token**.
3. The onboarding page now defaults to "Create company" mode, with no record of the invite they were trying to accept.

The token only survives if the user is already signed in when they click the email link, which is almost never the case for a new invitee.

## Fix

Preserve the invite token across every auth redirect in the join flow.

### 1. `src/routes/onboarding.tsx`
- When unauthenticated, redirect to **`/signup?invite=TOKEN`** instead of `/login` (invitees are usually new users), but include a "Sign in" link that also carries the token.
- Preserve `invite` in the redirect search params (currently passes `{ invite: undefined }`).

### 2. `src/routes/login.tsx`
- Add `validateSearch` to accept `?invite=TOKEN` and `?redirect=`.
- After successful sign-in, if `invite` is present, navigate to `/onboarding?invite=TOKEN` instead of `/`.
- Add a "Have an invite? Sign up here" hint that forwards the token to signup.

### 3. `src/routes/signup.tsx`
- Add `validateSearch` to accept `?invite=TOKEN`.
- When the token is present:
  - Auto-advance the affiliation toggle to `"invite"`.
  - Pre-fill `inviteToken` from the URL.
  - Call `get_invite_preview` RPC and show "You're joining **{company}** as **{role}**" above the form so the user sees what they're accepting.
  - Pre-fill the email field from the invite preview (and lock it, since the invite is bound to that email).
- Pass the token through `emailRedirectTo` (already done) so email confirmation also returns to `/onboarding?invite=TOKEN`.

### 4. `src/routes/_app.tsx`
- When the user has no `company_id`, check for `?invite=` on the current URL and forward it to `/onboarding` instead of stripping it.

## Result

Clicking the invite email link will:
- Take a brand-new user straight to signup with the company/role preview visible and the token pre-filled.
- Take an existing user to login, then bounce to `/onboarding?invite=TOKEN` where the existing invite preview UI already auto-accepts.

No database or RPC changes required — `accept_company_invite` and `get_invite_preview` already exist.
