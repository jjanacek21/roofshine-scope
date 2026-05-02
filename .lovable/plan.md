## Why you don't see the Lead Center

The Lead Center routes (`/leads`, `/leads/wizard`, etc.) are built and working, but no navigation entry was added to the app sidebar in the previous build, so there's no clickable way to reach them. This plan fixes that.

## Changes

### 1. Desktop sidebar — `src/components/layout/AppSidebar.tsx`
- Import the `Target` icon from `lucide-react`.
- Add a new entry to `WORKSPACE_NAV` between Jobs and Clients:
  - `{ to: "/leads", label: "Leads", icon: Target, badgeKey: null }`

### 2. Mobile sidebar — `src/components/layout/MobileSidebarSheet.tsx`
- Same icon import and same `WORKSPACE_NAV` entry so the link appears on phone/tablet as well.

That's it — both sidebars share the same `WORKSPACE_NAV` constant pattern, and the existing `isActive("/leads")` logic already highlights the tab on any `/leads/*` sub-route (Dashboard, List, Map, Pipeline, Import, AI Wizard, Savings, Training).

## Notes

- No new icon import package needed — `Target` is already in `lucide-react`.
- No route changes needed — every `/leads/*` route already exists and type-checks.
- After the edit, "Leads" will appear in the **Workspace** section of the sidebar on both desktop and mobile, just below Jobs.
