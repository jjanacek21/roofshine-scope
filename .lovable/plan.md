# Mobile access to Admin Portal

The desktop sidebar (which contains the **Admin Portal** link for super admins) is hidden below 1024px. On mobile there's currently no entry point to `/admin` other than typing the URL.

## Changes

### 1. New `src/components/layout/MobileSidebarSheet.tsx`
A hamburger button + slide-out `Sheet` containing the same nav as the desktop `AppSidebar`:
- **Workspace**: Dashboard, Jobs (with count badge), Clients
- **Admin**: Pricing, Settings, Team (company admins), **Admin Portal** (super admins only — shield icon)
- User chip + sign-out at bottom
- Hamburger button visible only `<lg`; auto-closes on navigation
- Reuses `useProfile`, `useAuth`, and the same jobs-count query as `AppSidebar.tsx`

### 2. Edit `src/components/layout/Topbar.tsx`
Mount `<MobileSidebarSheet />` at the far left of the topbar. Hamburger only renders below `lg` so desktop is unchanged.

## Result
At 420px you'll see a hamburger icon in the top bar. Tap it → slide-out panel → tap **Admin Portal** to reach `/admin`. Desktop sidebar behavior unchanged.
