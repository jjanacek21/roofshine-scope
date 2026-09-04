# Scope the header-to-hero logo bleed to globalcontractor.app only

## Problem

The marketing site (`src/pages/marketing/ref/*`) is shared by both domains:

- **gcn.claims** (Claim Buddy standalone) — serves it at `/` and `/product`, `/pricing`, etc.
- **globalcontractor.app** (platform) — serves the same pages at the marketing paths.

The last pass put the animated logo into the shared header for everyone, which changed the Claim Buddy marketing header. The user wants Claim Buddy's marketing page left exactly as it was; the animated logo bleed should only appear on the globalcontractor.app surface.

## Approach

Surface-conditional bleed: the rendered markup stays the original Claim Buddy layout by default, and the logo moves into the header only when the app detects the platform surface (`getSurface() === "platform"`, i.e. globalcontractor.app, previews, localhost — anything that is not gcn.claims).

## Changes (only the three marketing files already touched)

1. **`src/pages/marketing/ref/refMarkup.ts`** — restore the original Claim Buddy markup:
   - Revert the header to the plain text wordmark (no `.nav-logo` / `#logoAnim` in `REF_HEADER`).
   - Restore the hero `.logo-wrap` containing `#logoAnim` in the home view, so the server-rendered output is the original design on both domains.
   - Add an empty `<span class="nav-logo-slot" data-v="home">` (or reuse a minimal mount point) in the header that stays hidden unless populated.

2. **`src/pages/marketing/ref/refRuntime.ts`** — in `playLogo()` (or a small `placeLogoForSurface()`):
   - If `getSurface() !== "platform"`, do nothing — the logo stays in the hero exactly as before (Claim Buddy unchanged).
   - On platform, move the existing `#logoAnim` element from the hero into the header slot before mounting the luma-key canvas, and add a `logo-in-header` class on the header so the bleed/glow CSS applies.
   - Keep the single-mount behavior (no remount on view switches).

3. **`src/pages/marketing/ref/marketing-ref.css`** — scope every new rule (`.nav-logo`, overhang, glow, hidden seam, hero top gradient/padding) under `header.nav.logo-in-header` / `.mkt-ref.logo-in-header` so none of it affects the Claim Buddy surface. Original header/hero rules remain the default.

No other files. No changes to CMS content, site-images assets, routes, or the Claim Buddy app itself.

## Verification

- Typecheck and build green.
- Playwright on `http://localhost:8080`:
  - `/?surface=standalone` — header and hero look exactly as before (wordmark header, logo in hero, no bleed).
  - `/?surface=platform` — logo sits in the header, bleeds into the hero with no square edges; hero has no duplicate logo.
  - Check top-of-page and scrolled (sticky header) states, desktop 1280px and phone viewport.
