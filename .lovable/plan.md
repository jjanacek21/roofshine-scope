
The user wants a visible way to reach `/admin` from the main app when logged in as a super_admin. Currently nothing in the sidebar links to it — only direct URL access works.

## Plan

Add a "Admin Portal" link in `src/components/layout/AppSidebar.tsx`, conditionally rendered only when `profile?.role === "super_admin"`.

### Placement
Inside the existing **Admin** section (below the Team link), add a new visually distinct entry styled with the brand Shield icon to signal elevated access.

### Implementation
- Extend `useProfile` consumer in `AppSidebar.tsx` with an `isSuperAdmin` check (`profile?.role === "super_admin"`).
- Add a `<Link to="/admin">` with the `Shield` icon from lucide-react, only rendered when `isSuperAdmin` is true.
- Use the same `nav-active` / hover styling as the other sidebar links so it fits the design system.
- The link uses `isActive("/admin")` so it highlights when on any `/admin/*` route.

### Files
- Edit: `src/components/layout/AppSidebar.tsx` (add Shield import, add conditional link)

### Out of scope (not changed)
- `MobileBottomTabs.tsx` — admin work is desktop-oriented; mobile bottom tabs stay focused on field workflows. Can add later if needed.
- `/admin` route guard — already correctly blocks non-super_admins.
