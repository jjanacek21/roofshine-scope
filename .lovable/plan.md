# Add mobile nav to Admin Portal

## Problem
The Admin Portal layout (`src/routes/admin.tsx`) renders its sidebar as `hidden lg:block`, so on mobile (your 420px viewport) you only see the Overview content with no way to navigate to Users, Companies, Training, etc.

## Fix
Add a mobile-only top bar inside `admin.tsx` with:
- **Hamburger button** (left) → opens a `Sheet` from the left containing the full admin nav (Overview, Users, Companies, Pricing, Announcements, Email Blasts, Home Page CMS, AI Training, Measurement Reviews, Reviews, Plans, Feature Flags, Analytics, Support, Audit Log) plus the **Back to app** link.
- **"Admin Portal" title** (center) for context.
- Visible only `<lg`; the existing desktop sidebar is unchanged.
- Sheet auto-closes on link tap.

## Files
- `src/routes/admin.tsx` — add mobile header + Sheet, reuse the existing `NAV` array.

## Result
At 420px you'll see a hamburger icon at the top of the admin portal. Tap it to access every admin page.
