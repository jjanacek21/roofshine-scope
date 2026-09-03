# Move Company Training onto globalcontractor.app + add a GCN APP button in Claim Buddy

Two separate corrections.

## 1. Company Training belongs to the GCN app, not Claim Buddy

Today the training screens live at `/cb/...`, which is why the back button drops you on the Claim Buddy dashboard. Training moves entirely onto the platform app.

Routes move (same screens, new addresses, all under the standard GCN app shell with the sidebar and topbar):

```text
/cb/training              ->  /training
/cb/training/course/$id   ->  /training/course/$id
/cb/training/lesson/$id   ->  /training/lesson/$id
/cb/training/scoreboard   ->  /training/scoreboard
/cb/training/live         ->  /training/live
/cb/admin/training        ->  /training/manage
```

- New files: `src/routes/_app.training.index.tsx`, `_app.training.course.$id.tsx`, `_app.training.lesson.$id.tsx`, `_app.training.scoreboard.tsx`, `_app.training.live.tsx`, `_app.training.manage.tsx`. The page bodies come from the existing `cb.training.*` / `cb.admin.training.tsx` files; the old `cb.*` training route files are deleted.
- The `CbSurface` wrapper is dropped so training inherits the normal GCN light theme instead of the Claim Buddy surface. Shared building blocks that are pure UI (course builder, lesson player, quiz runner, tutor) are reused as-is.
- Every in-page "Dashboard" / "Training" back link points at `/` and `/training` — never `/cb`.
- The Company Resources nav entries in `AppSidebar.tsx` and `MobileSidebarSheet.tsx` are repointed from `/cb/training` to `/training`, still directly under Survival Guide.
- Old `/cb/training*` and `/cb/admin/training` paths keep working as permanent redirects to the new paths so existing links and bookmarks don't 404.

Data model, tables, uploads and permissions are unchanged — this is a relocation, not a rebuild. Course data is scoped by company as it is today.

## 2. "GCN APP" button on the Claim Buddy dashboard

On `src/components/claim-buddy/CbDashboard.tsx`, add a **GCN APP** button in the dashboard header.

Behavior on tap:

- User's account has Global Contractor access → go to the GCN dashboard at `/`.
- User's account does not have GCN access → go to an upgrade/demo landing page.

Access is read from the Claim Buddy session's existing `hasGcAccess` flag (it already resolves whether the signed-in user is linked to a Global Contractor company), so no new database work is required.

### The upgrade landing page

New route `/gcn-app` — a short page shown to Claim Buddy-only users:

- Headline explaining the Global Contractor app (full CRM, jobs, estimates, invoicing, storm intelligence, training) is a separate product tier.
- Two actions: **Request a demo** (routes to the existing demo request flow) and **Upgrade my membership** (routes to pricing).
- Styled with the app's existing tokens; own `head()` metadata.

The button is shown on both surfaces. On `gcn.claims` the same rule applies: a user with GCN access goes to `/`, everyone else lands on `/gcn-app`.

## Technical notes

- No schema migration.
- `cbHomePath()` is not needed once training leaves `/cb`; the GCN APP button uses `hasGcAccess` directly.
- Verify with `bunx tsgo --noEmit -p tsconfig.json` and a green build log.
