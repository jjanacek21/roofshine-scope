## Diagnosis

The invite for `michaelgrossofl@gmail.com` was created in the database (a83d65b6…, expires 2026‑05‑21, never accepted), but no email left the system. Reason:

- `supabase/functions/send-invite-email/index.ts` calls Resend with `from: "BuildScopeAI <onboarding@resend.dev>"`.
- `onboarding@resend.dev` is Resend's shared test sender. Resend only delivers messages from that address to the email that owns the Resend account; sends to any other recipient (Michael's Gmail, etc.) are rejected with a 403 and the call returns silently because the UI swallows errors in a `try/catch`.
- No Lovable email domain is configured either, so we have no verified sender at all today.

So every invite has been created successfully but no recipient has ever actually received an email. Admins have only been able to share invites by copying the link manually.

## Recommended fix — switch invites to Lovable Cloud Emails

Lovable Cloud has built‑in transactional email with a verified sender domain, queue + retries, suppression handling, and a branded React Email template. This replaces the brittle Resend test setup.

### Steps

1. **Set up an email sender domain** via the email setup dialog (e.g. `notify.globalcontractor.app`). DNS verification can run in the background — scaffolding doesn't have to wait.
2. **Provision email infrastructure** (queues, cron dispatcher, suppression tables, unsubscribe tokens). One‑time setup.
3. **Scaffold transactional email infrastructure** (server route at `/lovable/email/transactional/send`, unsubscribe page, registry).
4. **Create a `company-invite` React Email template** in `src/lib/email-templates/company-invite.tsx` — branded with the app's blue gradient + Archivo, accepting `inviterName`, `companyName`, `inviteUrl`, `role` as props. Register it in `registry.ts`.
5. **Add a `sendTransactionalEmail` helper** at `src/lib/email/send.ts` that posts to `/lovable/email/transactional/send` with the user's session.
6. **Replace all 5 call sites** (`_app.team.invites.tsx`, `admin.users.tsx` ×2, `admin.companies.$id.tsx`, `admin.companies.tsx`) — swap `supabase.functions.invoke("send-invite-email", …)` for `sendTransactionalEmail({ templateName: 'company-invite', recipientEmail, idempotencyKey: \`invite-${invite.id}\`, templateData: { inviterName, companyName, inviteUrl, role } })`. Also surface failures with a toast instead of swallowing them silently so future delivery problems are visible.
7. **Delete the old `send-invite-email` edge function** and its `[functions.send-invite-email]` block in `supabase/config.toml`.
8. **Resend Michael's invite** from the Team → Invites page once the new pipeline is in place. The same token stays valid until 2026‑05‑21, so we don't need to recreate the row.

### Why Lovable Email vs. fixing Resend

- Resend would still work if the user verified their domain in Resend's dashboard and updated the `from:` address — but it requires a separate Resend account, separate DNS records, and we'd still be without queue/retry/suppression.
- Lovable Email keeps everything inside the project, uses the existing branded domain, and is the native path for transactional sends in this stack.

## Out of scope

- Custom analytics on invite open / click rates.
- Bulk re‑invite of all stale rows (only Michael's exists today; we'll resend manually after the cutover).
- Reskinning of the existing auth emails (signup confirmation, password reset). Can be added later via `scaffold_auth_email_templates` if desired.
