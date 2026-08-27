# Your admin account is fine — the app misreads a failed lookup as "no company"

## What I checked

Your account and data are intact in the database:

- `jaredjjanacek@gmail.com` is still a **super_admin**, attached to **Global Contractor Network**, company status `active`.
- It is still an owner/admin member of the Global Contractor Network and RRCA Claim Buddy workspaces.
- Row-level security and table permissions on `profiles` / `companies` are correct, and the helper functions used by the policies are unchanged.

So nothing was deleted or reset.

## What actually happened

The auth logs show your session's refresh token failed right before this
(`Invalid Refresh Token: Refresh Token Not Found` on globalcontractor.app at 20:47),
after which you signed in again.

The app gate that runs on every page load asks the database for your profile and
then does this: if it doesn't get a row back, it sends you to "create a company".
It never distinguishes between *"this user genuinely has no company"* and
*"the request failed / the token was rejected"*. With a stale token the request
comes back empty, so an existing super admin gets dropped onto the new-company
wizard. Claim Buddy's entry screen has the same shape: zero workspaces returned
for any reason sends you to its onboarding.

## The fix

1. **Treat an error as an error, not as "no company."** In the app gate, capture
   the error from the profile lookup. Only route to onboarding when the query
   succeeded and `company_id` is truly null.
2. **Refresh the session and retry once.** If the lookup fails with an auth error,
   refresh the Supabase session and retry. If it still fails, sign out and go to
   the login screen with a clear message — never to company setup.
3. **Show a recoverable error state** instead of silently redirecting: a short
   "Couldn't load your account" panel with Retry and Sign out.
4. **Apply the same guard to Claim Buddy's entry screen**, which redirects to
   `/cb/onboarding` whenever the workspace context comes back empty — including
   when the RPC errored.
5. **Safety rail:** never route a `super_admin` into the create-company wizard.

## Technical notes

- `src/routes/_app.tsx`: the `useEffect` gate ignores `error` from the
  `profiles` select and from the `companies` status read. Destructure both, add a
  single `supabase.auth.refreshSession()` + retry on failure, and gate the
  `/onboarding` navigation on `!error && !data?.company_id`.
- `src/routes/cb.index.tsx` line 46: gate the `/cb/onboarding` redirect on the
  Claim Buddy session having loaded without `error`, using the existing `error`
  field already exposed by `CbSessionProvider`.
- No database changes and no schema migration — this is entirely a client-side
  routing-guard fix.
