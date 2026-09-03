# Fix training "Back to dashboard" + add "Return to GCN Dashboard" on platform

## Problem

1. **Training back button goes to the wrong dashboard.** When you open Company Training from the Global Contractor app (Company Resources → Survival Guide → Company Training) and click **Dashboard**, it navigates to `/cb` — the Claim Buddy dashboard — instead of back to the GCN app.

2. **No way home from Claim Buddy on globalcontractor.app.** When Claim Buddy is used inside the platform app (`globalcontractor.app/claim-buddy`), the Claim Buddy dashboard has no button to return to the GCN dashboard (`/`).

## Changes

### 1. Shared "home" helper

Add a tiny helper in `src/lib/cbMode.ts`:

```ts
export function cbHomePath(): "/" | "/cb" {
  return isStandalone() ? "/cb" : "/";
}
```

- On `gcn.claims` (standalone): home is `/cb` (unchanged behavior).
- On `globalcontractor.app` / preview / localhost (platform): home is `/`.

### 2. Training pages use the helper

Replace every hardcoded `navigate({ to: "/cb" })` used as a "back to dashboard" action with `navigate({ to: cbHomePath() })` in:

- `src/routes/cb.training.index.tsx` (the **Dashboard** button)
- `src/routes/cb.training.course.$id.tsx`, `cb.training.lesson.$id.tsx`, `cb.training.scoreboard.tsx`, `cb.training.live.tsx` — only where a back/dashboard link points at `/cb`; course/lesson/scoreboard links between training pages stay untouched.

Same rule applied to `src/routes/cb.admin.training.tsx` if it has a `/cb` back link.

### 3. "Return to GCN Dashboard" button

In `src/components/claim-buddy/CbDashboard.tsx`, when `getSurface() === "platform"`, render a secondary button at the top of the dashboard:

- Label: **← Return to GCN Dashboard**
- `navigate({ to: "/" })`
- Styled with existing `CbButton variant="secondary"` so it inherits the locked Claim Buddy UI.
- Hidden on the standalone `gcn.claims` surface (where `/` is the marketing page and `/cb` IS home).

## Out of scope

- No changes to routing, the standalone gate, or any styling beyond the one button.
- No changes to where Company Training lives in navigation (already fixed under Company Resources).

## Verification

- `bunx tsgo --noEmit -p tsconfig.json` clean.
- Confirm build log shows `build OK`.
