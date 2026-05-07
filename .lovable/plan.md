# Fix invite email mismatch + add edit/clearer error

Michael's invite was sent to `michaelgrossofl@gmail.com` but he signed up as `michael.grosso@rrcausa.com`, so `accept_company_invite` rightly rejects it.

## 1. Resend to his real email (data fix)

Run a one-off update on his pending invite to point it at `michael.grosso@rrcausa.com`, then resend the email from the Team → Invites page.

```sql
UPDATE company_invites
   SET email = 'michael.grosso@rrcausa.com',
       expires_at = now() + interval '14 days'
 WHERE email = 'michaelgrossofl@gmail.com'
   AND accepted_at IS NULL;
```

## 2. Edit invite email in Team page

In `src/routes/_app.team.invites.tsx`, add a pencil icon next to each pending invite row. Clicking opens a small inline input → Save calls a new `update_company_invite_email(_id, _new_email)` SECURITY DEFINER RPC that:
- Verifies caller is `is_company_admin()` for the invite's company.
- Rejects if `accepted_at IS NOT NULL`.
- Updates `email` and bumps `expires_at` to `now() + 14 days`.

After save, auto-trigger the existing `send-invite-email` edge function to the new address.

## 3. Clearer error on /onboarding

Two improvements in `src/routes/onboarding.tsx`:

a. **Better RPC error**: Update `accept_company_invite` to raise a structured message:
   `Invite was sent to <invite_email>. You're signed in as <user_email>. Sign out and sign back in with the invited email, or ask your admin to update the invite.`

b. **Pre-flight check in UI**: When `invitePreview` loads, compare `invitePreview.email` to the current `user.email`. If they don't match, show an inline warning above the Accept button:
   > ⚠️ This invite was sent to **michaelgrossofl@gmail.com** but you're signed in as **michael.grosso@rrcausa.com**. [Sign out] and sign in with the invited email, or ask your admin to update the invite.

Sign-out button calls `supabase.auth.signOut()` and routes to `/login`.

## Order of execution

1. Migration: update `accept_company_invite` error text + add `update_company_invite_email` RPC.
2. Data fix: update Michael's invite row.
3. Frontend: edit-email UI in invites page + mismatch warning in onboarding.
4. Tell user to hit Resend on Michael's invite.
