
Easiest route: use Supabase's built-in password reset (default mailer). No Resend wiring, no auth hooks, no domain verification. Three small files.

## Plan

### 1. `src/routes/forgot-password.tsx` (new)
- Email input → `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Toast success, link back to `/login`
- Same dark card styling as login

### 2. `src/routes/reset-password.tsx` (new, public)
- On mount, Supabase auto-parses the recovery token from URL hash and fires a `PASSWORD_RECOVERY` auth event
- New password + confirm fields → `supabase.auth.updateUser({ password })`
- Success → toast + redirect to `/login`

### 3. `src/routes/login.tsx` (edit)
- Add "Forgot password?" link under password field → `/forgot-password`

### Email delivery
Supabase's default mailer sends the reset email automatically. Works out of the box. If later you want branded emails from your domain via Resend, that's a separate setup (auth email hook + verified domain) — happy to do as a follow-up.
